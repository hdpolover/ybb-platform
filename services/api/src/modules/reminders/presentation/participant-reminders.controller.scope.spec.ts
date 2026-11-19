// services/api/src/modules/reminders/presentation/participant-reminders.controller.scope.spec.ts
//
// Every reminder route is keyed by :programId but carried only @Roles, so a
// scoped admin could preview another programme's recipients or schedule mail
// to them. The service already binds :id to :programId, so scoping the param
// covers the child routes too. Drives the REAL AdminScopeGuard against the real
// route metadata.
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ParticipantRemindersController } from './participant-reminders.controller';

const BASE = { canManageAdmins: false, canAssignRoles: false, customPermissions: [], role: { name: 'admin', permissions: [] } };
const BRAND_ADMIN = { ...BASE, accessLevel: 3, adminBrands: [{ brandId: 'brand-a', permissions: [] }], adminPrograms: [] };
const ASSIGNED_ADMIN = { ...BASE, accessLevel: 1, adminBrands: [], adminPrograms: [{ programId: 'prog-a', permissions: [] }] };
const PLATFORM_ADMIN = { ...BASE, accessLevel: 10, role: { name: 'super admin', permissions: ['*'] }, adminBrands: [], adminPrograms: [] };

describe('ParticipantRemindersController scope enforcement (real AdminScopeGuard)', () => {
  const prismaRead = { admin: { findUnique: jest.fn() }, program: { findUnique: jest.fn() } };
  const guard = new AdminScopeGuard(new Reflector(), prismaRead as unknown as PrismaReadService);

  function contextFor(handler: (...args: never[]) => unknown, params: Record<string, string>): ExecutionContext {
    const request = { user: { adminId: 'admin-1' }, params };
    return {
      getHandler: () => handler,
      getClass: () => ParticipantRemindersController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  const p = ParticipantRemindersController.prototype;
  const routes: Array<[string, (...args: never[]) => unknown]> = [
    ['GET audience', p.getAudience],
    ['POST preview', p.previewMessage],
    ['GET list', p.list],
    ['GET :id', p.get],
    ['POST create', p.create],
    ['PUT :id', p.update],
    ['POST :id/cancel', p.cancel],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prismaRead.program.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, brandId: where.id === 'prog-a' ? 'brand-a' : 'brand-b', name: 'P', deletedAt: null }),
    );
  });

  it.each(routes)('%s: out-of-scope brand and assigned admins get 404', async (_n, handler) => {
    for (const admin of [BRAND_ADMIN, ASSIGNED_ADMIN]) {
      prismaRead.admin.findUnique.mockResolvedValue(admin);
      await expect(guard.canActivate(contextFor(handler, { programId: 'prog-b', id: 'r-1' }))).rejects.toThrow(NotFoundException);
    }
  });

  it.each(routes)('%s: in-scope brand and assigned admins pass', async (_n, handler) => {
    for (const admin of [BRAND_ADMIN, ASSIGNED_ADMIN]) {
      prismaRead.admin.findUnique.mockResolvedValue(admin);
      await expect(guard.canActivate(contextFor(handler, { programId: 'prog-a', id: 'r-1' }))).resolves.toBe(true);
    }
  });

  it.each(routes)('%s: platform admin passes on any program', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { programId: 'prog-b', id: 'r-1' }))).resolves.toBe(true);
  });
});
