// services/api/src/modules/stats/stats.controller.scope.spec.ts
//
// The program stats routes carried only @Roles, so a brand- or program-scoped
// admin could read any programme's dashboard, payments and participant
// analytics by id. Drives the REAL AdminScopeGuard against the real route
// metadata (only PrismaReadService is faked), so dropping or mis-pointing a
// @ScopedBy fails here.
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { StatsController } from './stats.controller';

const BASE = { canManageAdmins: false, canAssignRoles: false, customPermissions: [], role: { name: 'admin', permissions: [] } };
const BRAND_ADMIN = { ...BASE, accessLevel: 3, adminBrands: [{ brandId: 'brand-a', permissions: [] }], adminPrograms: [] };
const ASSIGNED_ADMIN = { ...BASE, accessLevel: 1, adminBrands: [], adminPrograms: [{ programId: 'prog-a', permissions: [] }] };
const PLATFORM_ADMIN = { ...BASE, accessLevel: 10, role: { name: 'super admin', permissions: ['*'] }, adminBrands: [], adminPrograms: [] };

describe('StatsController admin routes scope enforcement (real AdminScopeGuard)', () => {
  const prismaRead = { admin: { findUnique: jest.fn() }, program: { findUnique: jest.fn() } };
  const guard = new AdminScopeGuard(new Reflector(), prismaRead as unknown as PrismaReadService);

  function contextFor(handler: (...args: never[]) => unknown, params: Record<string, string>): ExecutionContext {
    const request = { user: { adminId: 'admin-1' }, params };
    return {
      getHandler: () => handler,
      getClass: () => StatsController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  const p = StatsController.prototype;
  const programRoutes: Array<[string, (...args: never[]) => unknown]> = [
    ['dashboard', p.getAdminProgramDashboard],
    ['analytics', p.getAdminProgramAnalytics],
    ['analytics/knowledge-source', p.getKnowledgeSourceAnalytics],
    ['analytics/nationality', p.getNationalityAnalytics],
    ['analytics/gender', p.getGenderAnalytics],
    ['analytics/age', p.getAgeAnalytics],
    ['analytics/registrations', p.getRegistrationsAnalytics],
    ['analytics/ambassadors', p.getAmbassadorsAnalytics],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prismaRead.program.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, brandId: where.id === 'prog-a' ? 'brand-a' : 'brand-b', name: 'P', deletedAt: null }),
    );
  });

  it.each(programRoutes)("%s: brand-row-only admin gets 404 on another brand's program", async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { programId: 'prog-b' }))).rejects.toThrow(NotFoundException);
  });

  it.each(programRoutes)('%s: assigned admin gets 404 on a program not assigned to them', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(ASSIGNED_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { programId: 'prog-b' }))).rejects.toThrow(NotFoundException);
  });

  it.each(programRoutes)('%s: assigned admin passes on their own program', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(ASSIGNED_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { programId: 'prog-a' }))).resolves.toBe(true);
  });

  // brand rows grant nothing (owner policy 2026-11-19)
  it.each(programRoutes)('%s: brand-row-only admin gets 404 even on a program in their brand', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(BRAND_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { programId: 'prog-a' }))).rejects.toThrow(NotFoundException);
  });

  it.each(programRoutes)('%s: platform admin passes on any program', async (_n, handler) => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
    await expect(guard.canActivate(contextFor(handler, { programId: 'prog-b' }))).resolves.toBe(true);
  });

  it('admin/analytics is platform-only: scoped admins get 403, platform passes', async () => {
    for (const admin of [BRAND_ADMIN, ASSIGNED_ADMIN]) {
      prismaRead.admin.findUnique.mockResolvedValue(admin);
      await expect(guard.canActivate(contextFor(p.getAdminAnalytics, {}))).rejects.toThrow(ForbiddenException);
    }
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ADMIN);
    await expect(guard.canActivate(contextFor(p.getAdminAnalytics, {}))).resolves.toBe(true);
  });

  it('public GET /stats stays unscoped', async () => {
    await expect(guard.canActivate(contextFor(p.getStats, {}))).resolves.toBe(true);
    expect(prismaRead.admin.findUnique).not.toHaveBeenCalled();
  });
});
