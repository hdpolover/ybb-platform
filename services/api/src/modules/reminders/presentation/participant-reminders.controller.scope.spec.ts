// services/api/src/modules/reminders/presentation/participant-reminders.controller.scope.spec.ts
//
// Every reminder route is keyed by :programId but carried only @Roles, so a
// scoped admin could preview another programme's recipients or schedule mail
// to them. The service already binds :id to :programId, so scoping the param
// covers the child routes too. Drives the REAL AdminScopeGuard against the real
// route metadata.
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { AdminPermissionGuard } from '@shared/guards/admin-permission.guard';
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

  it.each(routes)('%s: out-of-scope brand-row-only and assigned admins get 404', async (_n, handler) => {
    for (const admin of [BRAND_ADMIN, ASSIGNED_ADMIN]) {
      prismaRead.admin.findUnique.mockResolvedValue(admin);
      await expect(guard.canActivate(contextFor(handler, { programId: 'prog-b', id: 'r-1' }))).rejects.toThrow(NotFoundException);
    }
  });

  it.each(routes)('%s: assigned admin passes on their own program', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(ASSIGNED_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { programId: 'prog-a', id: 'r-1' }))).resolves.toBe(true);
  });

  // brand rows grant nothing (owner policy 2026-11-19)
  it.each(routes)('%s: brand-row-only admin gets 404 even on a program in their brand', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { programId: 'prog-a', id: 'r-1' }))).rejects.toThrow(NotFoundException);
  });

  it.each(routes)('%s: platform admin passes on any program', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { programId: 'prog-b', id: 'r-1' }))).resolves.toBe(true);
  });
});

describe('ParticipantRemindersController writes need participants:write or program:write', () => {
  const prismaRead = { admin: { findUnique: jest.fn() }, program: { findUnique: jest.fn() } };
  const guard = new AdminPermissionGuard(new Reflector(), prismaRead as unknown as PrismaReadService);
  const p = ParticipantRemindersController.prototype;
  const writes: Array<[string, (...args: never[]) => unknown]> = [
    ['POST create', p.create],
    ['PUT :id', p.update],
    ['POST :id/cancel', p.cancel],
  ];
  const reads: Array<[string, (...args: never[]) => unknown]> = [
    ['GET audience', p.getAudience],
    ['POST preview', p.previewMessage],
    ['GET list', p.list],
    ['GET :id', p.get],
  ];
  const withRole = (permissions: string[]) => ({ ...ASSIGNED_ADMIN, role: { name: 'Scoped', permissions } });
  const context = (handler: (...args: never[]) => unknown) =>
    ({
      getHandler: () => handler,
      getClass: () => ParticipantRemindersController,
      switchToHttp: () => ({ getRequest: () => ({ user: { adminId: 'admin-1' }, params: { programId: 'prog-a', id: 'r-1' } }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it.each(writes)('%s: 403 for an in-scope admin with announcements:write only', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(withRole(['announcements:write', 'payments:read']));
    await expect(guard.canActivate(context(handler))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(writes)('%s: passes with participants:write (Digital Marketing) or program:write', async (_n, handler) => {
    for (const permission of ['participants:write', 'program:write']) {
      prismaRead.admin.findUnique.mockResolvedValue(withRole([permission]));
      await expect(guard.canActivate(context(handler))).resolves.toBe(true);
    }
  });

  it.each(writes)('%s: platform admin passes', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
    await expect(guard.canActivate(context(handler))).resolves.toBe(true);
  });

  it.each(reads)('%s: stays open (no permission required)', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(withRole([]));
    await expect(guard.canActivate(context(handler))).resolves.toBe(true);
    expect(prismaRead.admin.findUnique).not.toHaveBeenCalled();
  });
});
