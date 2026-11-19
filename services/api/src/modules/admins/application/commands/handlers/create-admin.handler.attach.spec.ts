// services/api/src/modules/admins/application/commands/handlers/create-admin.handler.attach.spec.ts
import { ConflictException } from '@nestjs/common';
import { CreateAdminHandler } from './create-admin.handler';
import { CreateAdminCommand } from '../create-admin.command';

describe('CreateAdminHandler - caller-vetted user (access request approval)', () => {
  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: 'new-user' }) },
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
  const cmd = (homeBrandId?: string, existingUserId?: string) =>
    new CreateAdminCommand('a@ybb.org', 'A', 'pw-pw-pw-pw', 'creator', 'r', [], ['p1'], homeBrandId, existingUserId);

  beforeEach(() => jest.clearAllMocks());

  it('attaches to the existing user row: no user created, no email-exists check', async () => {
    await handler.execute(cmd('brand-1', 'participant-user'));

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.admin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'participant-user', roleId: 'r' }),
    });
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
