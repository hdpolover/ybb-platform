import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ResetPasswordCommand } from '../reset-password.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ResetPasswordHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authLoggingService: AuthLoggingService,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<{ message: string }> {
    const { token, newPassword } = command;

    // Find user with valid token.
    //
    // isActive/deletedAt are part of the lookup, not a later branch: a revoked
    // account must not be able to consume a reset token at all. isActive:false
    // is only ever set deliberately — admin deactivate, admin delete, or an
    // APPROVED account-deletion request pending its 30-day purge. The error
    // below is deliberately the same one an unknown token gets, so this leaks
    // nothing about which accounts are deactivated.
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(), // Token must not be expired
        },
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user: set new password, clear reset token/expiry.
    //
    // This used to also set isActive: true, which let anyone with inbox access
    // to a deactivated account undo the deactivation through an unauthenticated
    // self-service flow — including an account an admin had already approved
    // for deletion, which came back live while the request row still read
    // "approved". Reactivation is a deliberate admin action with its own
    // endpoint (PATCH /users/:id/activate); it does not belong here.
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        lastPasswordChange: new Date(),
        // A completed reset clears account lockout. This is the ONLY
        // self-service escape a password-only account has: isLockedOut() is
        // checked before the credential compare on every login route, so a
        // locked user cannot log in to clear it, and nothing else resets these
        // fields except a successful login or an admin. Without this a remote
        // attacker holding an account locked could not be shaken off by the
        // owner at all. Proving control of the mailbox is a strictly stronger
        // credential than the password the lockout was protecting, so honouring
        // it here does not weaken the control.
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // A password reset means the old credential is presumed compromised, so
    // every session it authorised has to go.
    //
    // In practice this only bites for ADMINS: userSession rows are read for
    // authentication in exactly one place (admin-refresh.handler.ts), so
    // revoking them here is what stops an admin's 7-day refresh token from
    // minting fresh access tokens. Participants have no refresh endpoint, so
    // for them the rows are audit trail only and their access token simply
    // dies at its own TTL — it cannot be revoked retroactively either way,
    // because its jti is never persisted.
    await this.prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { isActive: false, revokedAt: new Date() },
    });

    await this.authLoggingService.logPasswordReset(
        user.id,
        command.ipAddress || '0.0.0.0',
        command.userAgent || 'unknown',
    );

    return {
      message: 'Password has been successfully reset. You can now login with your new password.',
    };
  }
}
