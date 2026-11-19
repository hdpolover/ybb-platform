// services/api/src/modules/support/presentation/admin-support-tickets.controller.spec.ts
//
// Reply, status change and delete only checked program assignment, so any
// assigned admin (a reviewer, a news writer) could answer or close tickets.
// They now also need support:write, checked before any ticket is read or written.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@core/entities/user.entity';
import { AdminSupportTicketsController } from './admin-support-tickets.controller';

const PROGRAM_ID = 'prog-1';
const USER = { userId: 'user-1', adminId: 'admin-1', email: 'a@example.com', role: UserRole.ADMIN } as never;
const SUPER = { userId: 'user-2', adminId: 'admin-2', email: 's@example.com', role: UserRole.SUPER_ADMIN } as never;

const scopedAdmin = (permissions: string[]) => ({
  accessLevel: 1,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  role: { name: 'Scoped', permissions },
  adminBrands: [],
  adminPrograms: [{ programId: PROGRAM_ID, permissions: [] }],
});

function build(permissions: string[]) {
  const prisma = {
    admin: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', fullName: 'A', adminPrograms: [{ id: 'ap-1' }] }) },
    participantApplication: { findMany: jest.fn().mockResolvedValue([]) },
    supportTicket: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const prismaRead = { admin: { findUnique: jest.fn().mockResolvedValue(scopedAdmin(permissions)) }, program: { findUnique: jest.fn() } };
  const controller = new AdminSupportTicketsController(prisma as never, { publish: jest.fn() } as never, prismaRead as never);
  return { controller, prisma, prismaRead };
}

const writes = [
  { name: 'reply', call: (c: AdminSupportTicketsController, u: never) => c.reply(u, PROGRAM_ID, 't-1', { message: 'hi' } as never) },
  { name: 'update', call: (c: AdminSupportTicketsController, u: never) => c.update(u, PROGRAM_ID, 't-1', { status: 'closed' } as never) },
  { name: 'delete', call: (c: AdminSupportTicketsController, u: never) => c.delete(u, PROGRAM_ID, 't-1') },
];

describe('AdminSupportTicketsController write permissions', () => {
  it.each(writes)('$name: an assigned admin without support:write is refused before the ticket is touched', async ({ call }) => {
    const { controller, prisma } = build(['review:write', 'content:write']);
    await expect(call(controller, USER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.supportTicket.findFirst).not.toHaveBeenCalled();
    expect(prisma.supportTicket.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(writes)('$name: support:write gets through to the ticket lookup', async ({ call }) => {
    const { controller, prisma } = build(['support:write']);
    await expect(call(controller, USER)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supportTicket.findFirst).toHaveBeenCalled();
  });

  it.each(writes)('$name: a super admin needs no permission lookup', async ({ call }) => {
    const { controller, prismaRead } = build([]);
    await expect(call(controller, SUPER)).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaRead.admin.findUnique).not.toHaveBeenCalled();
  });
});
