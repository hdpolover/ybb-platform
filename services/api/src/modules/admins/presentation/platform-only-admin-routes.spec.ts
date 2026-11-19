// services/api/src/modules/admins/presentation/platform-only-admin-routes.spec.ts
//
// Global administration routes that carried only @Roles(ADMIN, SUPER_ADMIN),
// which every scoped admin satisfies: admin roles (global, and the 'roles.manage'
// permission let a brand admin past assertCanAssignRoles), login providers, the
// platform audit log (every brand's PII diffs) and account-deletion requests.
// Each is now @ScopedBy('platform').
//
// Driven through the real HTTP stack with the real AdminScopeGuard, so the test
// proves the guard is wired, not just that a helper exists. The first thing each
// route touches downstream answers 418, so "418" means the guard let the request
// through and "403 + never called" means it stopped it before any side effect.
import { Test } from '@nestjs/testing';
import { ExecutionContext, ImATeapotException, INestApplication, Type, ValueProvider } from '@nestjs/common';
import * as request from 'supertest';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { UserRole } from '@core/entities/user.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ExcelService } from '@shared/infrastructure/excel/excel.service';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';
import { AdminRolesController } from './admin-roles.controller';
import { AdminAccessControlService } from '../application/services/admin-access-control.service';
import { AuthProviderController } from '@modules/auth/presentation/auth-provider.controller';
import { CreateAuthProviderHandler } from '@modules/auth/application/commands/handlers/create-auth-provider.handler';
import { UpdateAuthProviderHandler } from '@modules/auth/application/commands/handlers/update-auth-provider.handler';
import { DeleteAuthProviderHandler } from '@modules/auth/application/commands/handlers/delete-auth-provider.handler';
import { AuditAdminController } from '@modules/audit/audit-admin.controller';
import { AuditCleanupService } from '@modules/audit/audit-cleanup.service';
import { DeletionRequestsController } from '@modules/users/presentation/deletion-requests.controller';
import { ListDeletionRequestsHandler } from '@modules/users/application/queries/handlers/list-deletion-requests.handler';
import { ReviewDeletionRequestHandler } from '@modules/users/application/commands/handlers/review-deletion-request.handler';

const reached = () => jest.fn().mockRejectedValue(new ImATeapotException('reached'));

// Prod personas (2026-11-19): Digital Marketing is brand_scope, Program Admin is
// assigned, Project Manager is platform through 'platform_access'.
const PERSONAS = {
  brandScoped: {
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: null,
    // roles.manage is exactly the grant that used to get a brand admin into /admin-roles.
    role: { name: 'Digital Marketing', permissions: ['participants:read', 'support:read', 'roles.manage'] },
    adminBrands: [{ brandId: 'brand-1', permissions: [] }],
    adminPrograms: [],
  },
  assigned: {
    accessLevel: 3,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: null,
    role: { name: 'Program Admin', permissions: ['program:read', 'participants:read'] },
    adminBrands: [],
    adminPrograms: [{ programId: 'program-1', permissions: [] }],
  },
  platform: {
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: null,
    role: { name: 'Project Manager', permissions: ['platform_access'] },
    adminBrands: [{ brandId: 'brand-1', permissions: [] }],
    adminPrograms: [],
  },
};

type Persona = keyof typeof PERSONAS;

interface Suite {
  controller: Type<unknown>;
  // Builds fresh downstream mocks; each returns its provider list and every spy.
  build: () => { providers: ValueProvider[]; spies: jest.Mock[] };
  routes: Array<[method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string]>;
}

const SUITES: Record<string, Suite> = {
  AdminRolesController: {
    controller: AdminRolesController,
    build: () => {
      const access = { assertCanAssignRoles: reached(), assertCanManageAdmins: reached() };
      return {
        providers: [
          { provide: AdminAccessControlService, useValue: access },
          { provide: PrismaService, useValue: {} },
        ],
        spies: [access.assertCanAssignRoles, access.assertCanManageAdmins],
      };
    },
    routes: [
      ['get', '/admin-roles'],
      ['post', '/admin-roles'],
      ['patch', '/admin-roles/role-1'],
      ['delete', '/admin-roles/role-1'],
    ],
  },
  AuthProviderController: {
    controller: AuthProviderController,
    build: () => {
      const handlers = [{ execute: reached() }, { execute: reached() }, { execute: reached() }];
      return {
        providers: [
          { provide: CreateAuthProviderHandler, useValue: handlers[0] },
          { provide: UpdateAuthProviderHandler, useValue: handlers[1] },
          { provide: DeleteAuthProviderHandler, useValue: handlers[2] },
        ],
        spies: handlers.map((h) => h.execute),
      };
    },
    routes: [
      ['post', '/auth/providers'],
      ['put', '/auth/providers/provider-1'],
      ['delete', '/auth/providers/provider-1'],
    ],
  },
  AuditAdminController: {
    controller: AuditAdminController,
    build: () => {
      const log = { findMany: reached(), findUnique: reached(), count: reached() };
      const cleanup = { cleanup: reached() };
      // export is reached for real now that it is declared before `:id`.
      const excel = { streamExcelRows: reached() };
      return {
        providers: [
          { provide: PrismaService, useValue: { dataChangeLog: log } },
          { provide: ExcelService, useValue: excel },
          { provide: AuditCleanupService, useValue: cleanup },
        ],
        spies: [log.findMany, log.findUnique, log.count, cleanup.cleanup, excel.streamExcelRows],
      };
    },
    routes: [
      ['get', '/admin/audit-logs'],
      ['get', '/admin/audit-logs/log-1'],
      ['get', '/admin/audit-logs/entity/User/user-1'],
      ['get', '/admin/audit-logs/export'],
      ['delete', '/admin/audit-logs/cleanup'],
    ],
  },
  DeletionRequestsController: {
    controller: DeletionRequestsController,
    build: () => {
      const list = { execute: reached() };
      const review = { execute: reached() };
      return {
        providers: [
          { provide: ListDeletionRequestsHandler, useValue: list },
          { provide: ReviewDeletionRequestHandler, useValue: review },
        ],
        spies: [list.execute, review.execute],
      };
    },
    routes: [
      ['get', '/admin/deletion-requests'],
      ['patch', '/admin/deletion-requests/request-1/review'],
    ],
  },
};

async function bootstrap(suite: Suite, persona: Persona) {
  const { providers, spies } = suite.build();
  const module = await Test.createTestingModule({
    controllers: [suite.controller],
    providers: [
      ...providers,
      {
        provide: PrismaReadService,
        useValue: { admin: { findUnique: jest.fn().mockResolvedValue(PERSONAS[persona]) } },
      },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        context.switchToHttp().getRequest().user = {
          userId: 'user-1',
          adminId: 'admin-1',
          role: [UserRole.ADMIN],
        };
        return true;
      },
    })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app: INestApplication = module.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return { app, spies };
}

describe.each(Object.entries(SUITES))('%s is platform only', (_name, suite) => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe.each(['brandScoped', 'assigned'] as const)('a %s admin', (persona) => {
    it.each(suite.routes)('is refused %s %s with 403 before the route runs', async (method, path) => {
      const booted = await bootstrap(suite, persona);
      app = booted.app;

      const res = await request(app.getHttpServer())[method](path).send({});

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toContain('restricted to platform administrators');
      booted.spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    });
  });

  it.each(suite.routes)('lets a platform admin through %s %s', async (method, path) => {
    const booted = await bootstrap(suite, 'platform');
    app = booted.app;

    const res = await request(app.getHttpServer())[method](path).send({});

    expect(res.status).toBe(418);
  });
});
