// services/api/src/modules/admins/application/services/admin-password-link.service.spec.ts
import { AdminPasswordLinkService, ADMIN_PASSWORD_LINK_TTL_MS } from './admin-password-link.service';
import { hashToken } from '@shared/utils/hash-token.util';

describe('AdminPasswordLinkService', () => {
  const prisma = {
    user: { update: jest.fn((args) => ({ op: 'user.update', args })) },
    userSession: { updateMany: jest.fn((args) => ({ op: 'session.updateMany', args })) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const producer = { emit: jest.fn().mockResolvedValue(true) };
  const service = new AdminPasswordLinkService(prisma as never, producer as never);

  beforeEach(() => jest.clearAllMocks());

  it('stores only the hash of the token and emits the raw token with a 72h expiry', async () => {
    const before = Date.now();
    await service.issue({ userId: 'u1', email: 'a@b.co', fullName: 'A B', kind: 'invite', roleName: 'Reviewer' });

    const data = prisma.user.update.mock.calls[0][0].data;
    const emitted = producer.emit.mock.calls[0][1];
    expect(producer.emit.mock.calls[0][0]).toBe('user.admin-password-link');
    expect(emitted.token).toMatch(/^[0-9a-f]{64}$/);
    expect(data.passwordResetToken).toBe(hashToken(emitted.token));
    expect(data.passwordResetToken).not.toBe(emitted.token);
    const ttl = data.passwordResetExpires.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(ADMIN_PASSWORD_LINK_TTL_MS - 1000);
    expect(ttl).toBeLessThanOrEqual(ADMIN_PASSWORD_LINK_TTL_MS + 5000);
    expect(ADMIN_PASSWORD_LINK_TTL_MS).toBe(72 * 60 * 60 * 1000);
    expect(emitted).toMatchObject({ email: 'a@b.co', kind: 'invite', roleName: 'Reviewer', brand: { name: 'YBB Platform' } });
  });

  it('invalidates the password, clears lockout and revokes sessions when asked to', async () => {
    await service.issue({ userId: 'u1', email: 'a@b.co', fullName: 'A', kind: 'reset', roleName: null, invalidateCredentials: true });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ passwordHash: null, failedLoginAttempts: 0, lockedUntil: null });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { isActive: false, revokedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('leaves the password and sessions alone for a plain invite', async () => {
    await service.issue({ userId: 'u1', email: 'a@b.co', fullName: 'A', kind: 'invite', roleName: 'x' });

    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('passwordHash');
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('does not emit when persisting the token fails', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.issue({ userId: 'u1', email: 'a@b.co', fullName: 'A', kind: 'invite', roleName: 'x' }),
    ).rejects.toThrow('db down');
    expect(producer.emit).not.toHaveBeenCalled();
  });
});
