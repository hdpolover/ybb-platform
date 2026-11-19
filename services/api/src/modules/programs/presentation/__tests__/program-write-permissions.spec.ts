// services/api/src/modules/programs/presentation/__tests__/program-write-permissions.spec.ts
//
// Program-keyed admin writes that used to be scope-only (@ScopedBy) now also
// need a role permission. Drives the REAL AdminPermissionGuard against the real
// route metadata; only Prisma is faked.
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ADMIN_PERMISSION_KEY, AdminPermissionGuard } from '@shared/guards/admin-permission.guard';
import { ADMIN_SCOPE_KEY, AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ProgramsController } from '../programs.controller';
import { ProgramExchangeRateController } from '../program-exchange-rate.controller';
import { ProgramParticipationController } from '../program-participation.controller';
import { ProgramApplicationConfigController } from '../program-application.controller';
import { AdminProgramsController } from '../admin-programs.controller';

type Handler = (...args: never[]) => unknown;

const PROGRAM_CONFIG = ['program:write'];
const PRICING = ['payments:write', 'program:write'];
const SUBMISSION_FORM = ['program:write'];
const REVIEW = ['review:write', 'applications:write'];

const P = ProgramsController.prototype;
const routes: Array<[string, Handler, object, string, string[]]> = [
  ['PUT programs/:id', P.update, ProgramsController, 'id', PROGRAM_CONFIG],
  ['PUT programs/:id/payment-info', P.updatePaymentInfo, ProgramsController, 'id', PRICING],
  ['PUT programs/:id/contact', P.updateContact, ProgramsController, 'id', PROGRAM_CONFIG],
  ['PUT programs/:id/partners-canva-url', P.updatePartnersCanvaUrl, ProgramsController, 'id', PROGRAM_CONFIG],
  ['PUT programs/:id/landing-content', P.updateLandingContent, ProgramsController, 'id', PROGRAM_CONFIG],
  ['POST programs/:id/branding', P.updateBranding, ProgramsController, 'id', PROGRAM_CONFIG],
  ['POST programs/:id/publish', P.publish, ProgramsController, 'id', PROGRAM_CONFIG],
  ['POST programs/:id/unpublish', P.unpublish, ProgramsController, 'id', PROGRAM_CONFIG],
  ['PUT programs/:programId/exchange-rate', ProgramExchangeRateController.prototype.updateExchangeRate, ProgramExchangeRateController, 'programId', PRICING],
  ['POST programs/:programId/participation-info', ProgramParticipationController.prototype.upsert, ProgramParticipationController, 'programId', PROGRAM_CONFIG],
  ['PUT programs/:id/essay-guidelines', ProgramApplicationConfigController.prototype.updateEssayGuidelines, ProgramApplicationConfigController, 'id', SUBMISSION_FORM],
  ['POST programs/:id/form-fields', ProgramApplicationConfigController.prototype.addFormField, ProgramApplicationConfigController, 'id', SUBMISSION_FORM],
  ['POST admin/programs/:programId/applications/funding-decision', AdminProgramsController.prototype.setFundingDecision, AdminProgramsController, 'programId', REVIEW],
];

const IN_SCOPE = {
  accessLevel: 1,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  adminBrands: [],
  adminPrograms: [{ programId: 'prog-a', permissions: [] }],
};
const withRole = (permissions: string[]) => ({ ...IN_SCOPE, role: { name: 'Scoped', permissions } });
// Prod "Admin" role shape: platform tier through platform_access, no grant-all.
const PLATFORM_ACCESS_ADMIN = { ...withRole(['platform_access']), adminPrograms: [] };
// Prod News Writer and Digital Marketing hold none of these sets.
const NEWS_WRITER = withRole(['content:write', 'announcements:write', 'media:write']);

describe('program-keyed admin writes need a role permission (real AdminPermissionGuard)', () => {
  const prismaRead = { admin: { findUnique: jest.fn() }, program: { findUnique: jest.fn() } };
  const guard = new AdminPermissionGuard(new Reflector(), prismaRead as unknown as PrismaReadService);

  function contextFor(handler: Handler, cls: object, params: Record<string, string>): ExecutionContext {
    const request = { user: { adminId: 'admin-1' }, params };
    return {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it.each(routes)('%s: AdminPermissionGuard runs after AdminScopeGuard (404 before 403)', (_name, handler, _cls, param, anyOf) => {
    const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler);
    expect(guards.indexOf(AdminPermissionGuard)).toBeGreaterThan(guards.indexOf(AdminScopeGuard));
    expect(guards.indexOf(AdminScopeGuard)).toBeGreaterThanOrEqual(0);
    expect(Reflect.getMetadata(ADMIN_PERMISSION_KEY, handler)).toEqual({ anyOf, paramName: param });
  });

  it.each(routes)('%s: 403 for an in-scope admin without the permission', async (_name, handler, cls, param) => {
    prismaRead.admin.findUnique.mockResolvedValue(NEWS_WRITER);
    await expect(guard.canActivate(contextFor(handler, cls, { [param]: 'prog-a' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(routes)('%s: passes with each permission of its set', async (_name, handler, cls, param, anyOf) => {
    for (const permission of anyOf) {
      prismaRead.admin.findUnique.mockResolvedValue(withRole([permission]));
      await expect(guard.canActivate(contextFor(handler, cls, { [param]: 'prog-a' }))).resolves.toBe(true);
    }
  });

  it.each(routes)('%s: a platform_access admin without the permission passes', async (_name, handler, cls, param) => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ACCESS_ADMIN);
    await expect(guard.canActivate(contextFor(handler, cls, { [param]: 'prog-b' }))).resolves.toBe(true);
  });
});

describe('DELETE programs/:id is platform-only (real AdminScopeGuard)', () => {
  const prismaRead = { admin: { findUnique: jest.fn() }, program: { findUnique: jest.fn() } };
  const guard = new AdminScopeGuard(new Reflector(), prismaRead as unknown as PrismaReadService);
  const contextFor = (): ExecutionContext => {
    const request = { user: { adminId: 'admin-1' }, params: { id: 'prog-a' } };
    return {
      getHandler: () => P.delete,
      getClass: () => ProgramsController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => jest.clearAllMocks());

  it('is @ScopedBy platform with no program permission to satisfy instead', () => {
    expect(Reflect.getMetadata(ADMIN_SCOPE_KEY, P.delete)).toEqual({ target: 'platform', paramName: 'id' });
    expect(Reflect.getMetadata(ADMIN_PERMISSION_KEY, P.delete)).toBeUndefined();
  });

  it('403 for a scoped admin holding program:write on that program', async () => {
    prismaRead.admin.findUnique.mockResolvedValue(withRole(['program:write']));
    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a platform admin passes', async () => {
    prismaRead.admin.findUnique.mockResolvedValue(PLATFORM_ACCESS_ADMIN);
    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
  });
});

describe('DELETE programs/:programId/participation-info/:id checks the permission on the row program', () => {
  const prismaRead = {
    admin: { findUnique: jest.fn() },
    program: { findUnique: jest.fn().mockResolvedValue({ id: 'prog-a', brandId: 'brand-a', name: 'P', deletedAt: null }) },
    programParticipationInfo: { findUnique: jest.fn().mockResolvedValue({ programId: 'prog-a' }) },
  };
  const commandBus = { execute: jest.fn().mockResolvedValue('reached') };
  const controller = new ProgramParticipationController(
    commandBus as unknown as CommandBus,
    {} as QueryBus,
    prismaRead as unknown as PrismaReadService,
  );
  const req = { user: { adminId: 'admin-1' } };

  beforeEach(() => commandBus.execute.mockClear());

  it('403 for an in-scope admin without program:write, nothing deleted', async () => {
    prismaRead.admin.findUnique.mockResolvedValue(NEWS_WRITER);
    await expect(controller.delete('prog-a', 'row-1', req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('passes with program:write', async () => {
    prismaRead.admin.findUnique.mockResolvedValue(withRole(['program:write']));
    await expect(controller.delete('prog-a', 'row-1', req)).resolves.toBe('reached');
  });
});
