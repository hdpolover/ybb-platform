// src/modules/auth/application/commands/handlers/reset-password.handler.spec.ts

import { BadRequestException } from '@nestjs/common';
import { ResetPasswordHandler } from './reset-password.handler';
import { ResetPasswordCommand } from '../reset-password.command';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

describe('ResetPasswordHandler - no reactivation, no surviving sessions', () => {
  let handler: ResetPasswordHandler;

  const prisma = {
    user: { findFirst: jest.fn(), update: jest.fn() },
    userSession: { updateMany: jest.fn() },
  };
  const authLogging = { logPasswordReset: jest.fn() };

  const command = () =>
    new ResetPasswordCommand('reset-token', 'new-password-123', '1.2.3.4', 'jest');

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1', isActive: true });
    prisma.user.update.mockResolvedValue({});
    prisma.userSession.updateMany.mockResolvedValue({ count: 2 });
    handler = new ResetPasswordHandler(
      prisma as unknown as PrismaService,
      authLogging as unknown as AuthLoggingService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('does not set isActive when resetting a password', async () => {
    // The handler used to write isActive: true unconditionally, so anyone with
    // inbox access to a deactivated account could undo the deactivation through
    // an unauthenticated flow — including an account already approved for
    // deletion, which came back live while the request row still read approved.
    await handler.execute(command());

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('isActive');
    expect(data).toEqual(expect.objectContaining({ passwordResetToken: null }));
  });

  it('clears account lockout, the only self-service escape there is', async () => {
    // THE DEFECT: failedLoginAttempts and lockedUntil were untouched here, and
    // isLockedOut() is checked BEFORE the credential is compared on every login
    // route — so a locked user could not log in to clear their own lock, and a
    // password-only account had no way out at all while an attacker kept
    // re-arming it.
    //
    // Against the OLD code this fails: the update wrote exactly four fields —
    // passwordHash, passwordResetToken, passwordResetExpires, lastPasswordChange
    // — and neither lockout field was among them.
    //
    // Honouring a completed reset here does not weaken the control: proving
    // control of the mailbox is a stronger credential than the password the
    // lockout was protecting.
    await handler.execute(command());

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).toEqual(
      expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
    );
  });

  it('will not even look up a deactivated or soft-deleted account', async () => {
    // Belt and braces on the same hole: a revoked account must not be able to
    // consume a reset token at all, so the state lives in the where clause
    // rather than in a branch someone can later reorder around.
    await handler.execute(command());

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, deletedAt: null }),
      }),
    );
  });

  it('rejects a token whose account no longer qualifies, with the generic error', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    // Same message an unknown token gets — a deactivated account must not be
    // distinguishable from a bad token.
    await expect(handler.execute(command())).rejects.toThrow(
      new BadRequestException('Invalid or expired password reset token'),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('revokes every live session for the user on a successful reset', async () => {
    // A reset means the old credential is presumed compromised. This is the one
    // place a revoke-all IS correct (unlike logout, which must revoke exactly
    // one session), because it kills the 7-day refresh tokens the old password
    // handed out.
    await handler.execute(command());

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { isActive: false, revokedAt: expect.any(Date) },
    });
  });
});
