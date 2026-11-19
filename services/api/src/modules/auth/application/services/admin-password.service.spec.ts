// services/api/src/modules/auth/application/services/admin-password.service.spec.ts
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminPasswordService } from './admin-password.service';
import { ADMIN_SELF_RESET_TTL_MS } from '../../../admins/application/services/admin-password-link.service';

const ACTOR = { userId: 'u1', email: 'a@b.co', brandId: 'b1', adminId: 'adm1', sid: 'current-sid' };
const OLD = 'OldPassw0rd!';
const NEW = 'NewPassw0rd!';

describe('AdminPasswordService', () => {
  let hash: string;
  const prisma = {
    user: {
      findFirst: jest.fn(),
      // failedLoginAttempts is read back by recordFailedAttempt
      update: jest.fn((args) => ({ op: 'user.update', args, failedLoginAttempts: 1 })),
    },
    userSession: { updateMany: jest.fn((args) => ({ op: 'session.updateMany', args })) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const links = { issue: jest.fn().mockResolvedValue(undefined) };
  const authLogging = { logPasswordChange: jest.fn(), logFailedLogin: jest.fn() };
  const service = new AdminPasswordService(prisma as never, links as never, authLogging as never);

  beforeAll(async () => {
    hash = await bcrypt.hash(OLD, 4);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', passwordHash: hash, lockedUntil: null });
  });

  describe('changeOwnPassword', () => {
    it('rejects a token without an admin id (participant or impersonation session)', async () => {
      await expect(
        service.changeOwnPassword({ ...ACTOR, adminId: undefined }, OLD, NEW, '1.1.1.1', 'ua'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('400s on a wrong current password, counts a failed attempt and changes nothing', async () => {
      await expect(service.changeOwnPassword(ACTOR, 'wrong', NEW, '1.1.1.1', 'ua')).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: { increment: 1 } }) }),
      );
      expect(authLogging.logFailedLogin).toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(authLogging.logPasswordChange).not.toHaveBeenCalled();
    });

    it('rejects a new password equal to the current one', async () => {
      await expect(service.changeOwnPassword(ACTOR, OLD, OLD, '1.1.1.1', 'ua')).rejects.toThrow(/different/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses while the account is locked out', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', passwordHash: hash, lockedUntil: new Date(Date.now() + 60_000) });
      await expect(service.changeOwnPassword(ACTOR, OLD, NEW, '1.1.1.1', 'ua')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('sets the new hash, revokes every session except the current one and writes the security log', async () => {
      const res = await service.changeOwnPassword(ACTOR, OLD, NEW, '9.9.9.9', 'ua');

      expect(res).toEqual({ ok: true });
      const userData = prisma.user.update.mock.calls[0][0].data;
      expect(await bcrypt.compare(NEW, userData.passwordHash)).toBe(true);
      expect(userData.lastPasswordChange).toBeInstanceOf(Date);
      expect(userData).toMatchObject({ passwordResetToken: null, passwordResetExpires: null, failedLoginAttempts: 0, lockedUntil: null });
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null, sessionToken: { not: 'current-sid' } },
        data: { isActive: false, revokedAt: expect.any(Date) },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(authLogging.logPasswordChange).toHaveBeenCalledWith('u1', '9.9.9.9', 'ua');
    });
  });

  describe('requestReset', () => {
    const adminUser = { id: 'u1', email: 'a@b.co', admin: { fullName: 'A B', role: { name: 'Reviewer' } } };
    const flush = () => new Promise((r) => setImmediate(r));

    it('looks up an active, non-deleted admin case-insensitively', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await service.requestReset('A@B.co');
      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({
        email: { equals: 'A@B.co', mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
        admin: { is: { deactivatedAt: null, deletedAt: null } },
      });
    });

    it('issues nothing and resolves quietly when no admin matches', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.requestReset('nobody@x.co')).resolves.toBeUndefined();
      expect(links.issue).not.toHaveBeenCalled();
    });

    it('issues a 1h self-requested reset link that keeps the old password working', async () => {
      prisma.user.findFirst.mockResolvedValue(adminUser);
      await service.requestReset('a@b.co');
      expect(links.issue).toHaveBeenCalledWith({
        userId: 'u1',
        email: 'a@b.co',
        fullName: 'A B',
        kind: 'reset',
        roleName: 'Reviewer',
        invalidateCredentials: false,
        ttlMs: ADMIN_SELF_RESET_TTL_MS,
        selfRequested: true,
      });
      expect(ADMIN_SELF_RESET_TTL_MS).toBe(60 * 60 * 1000);
    });

    it('does not wait for, or surface, a failing mail emit', async () => {
      prisma.user.findFirst.mockResolvedValue(adminUser);
      links.issue.mockRejectedValueOnce(new Error('rabbit down'));
      await expect(service.requestReset('a@b.co')).resolves.toBeUndefined();
      await flush();
    });
  });
});
