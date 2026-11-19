// services/api/src/modules/admins/application/commands/handlers/create-admin.handler.attach.spec.ts
import { ConflictException } from '@nestjs/common';
import { CreateAdminHandler } from './create-admin.handler';
import { CreateAdminCommand } from '../create-admin.command';

describe('CreateAdminHandler - caller-vetted user (access request approval)', () => {
  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: 'new-user' }), update: jest.fn().mockResolvedValue({}) },
    userSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    admin: { create: jest.fn().mockResolvedValue({ id: 'admin-1', userId: 'x' }) },
    adminBrand: { createMany: jest.fn() },
    adminProgram: { createMany: jest.fn() },
  };
  const prisma = {
    user: { findFirst: jest.fn() },
    adminRole: { findFirst: jest.fn().mockResolvedValue({ id: 'r', name: 'Reviewer', permissions: [] }) },
    program: { findMany: jest.fn().mockResolvedValue([{ id: 'p1', brandId: 'brand-1' }]) },
    brand: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const handler = new CreateAdminHandler(prisma as never);
  const cmd = (homeBrandId?: string, existingUserId?: string, password: string | null = 'pw-pw-pw-pw') =>
    new CreateAdminCommand('a@ybb.org', 'A', password, 'creator', 'r', [], ['p1'], homeBrandId, existingUserId);

  beforeEach(() => jest.clearAllMocks());

  it('attaches to the existing user row: no user created, no email-exists check', async () => {
    await handler.execute(cmd('brand-1', 'participant-user'));

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.admin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'participant-user', roleId: 'r' }),
    });
  });

  it('H1: kills the attached account password, lockout and sessions in the SAME transaction as the admin row', async () => {
    await handler.execute(cmd('brand-1', 'participant-user', null));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'participant-user' },
      data: { passwordHash: null, failedLoginAttempts: 0, lockedUntil: null },
    });
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'participant-user', revokedAt: null },
      data: { isActive: false, revokedAt: expect.any(Date) },
    });
    expect(tx.admin.create).toHaveBeenCalledTimes(1);
  });

  it('H1: a brand-new approved user is created with a null hash, not a random one', async () => {
    await handler.execute(cmd('brand-7', undefined, null));
    expect(tx.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ passwordHash: null }) });
  });

  it('still hashes a real password for plain POST /admins', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await handler.execute(cmd());
    expect(tx.user.create.mock.calls[0][0].data.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('creates a user in the named home brand even if the email exists in other brands', async () => {
    await handler.execute(cmd('brand-7'));

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(tx.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ brandId: 'brand-7', email: 'a@ybb.org' }) });
  });

  it('keeps the global duplicate-email refusal for plain POST /admins', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'other' });
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});
