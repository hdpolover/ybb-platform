// services/api/src/modules/applications/presentation/applications-review-scope.controller.spec.ts
//
// M97. POST /applications/:id/review carried only JwtAuthGuard + @Roles, and
// ReviewApplicationHandler goes straight from findById to canReview with no
// tenant assertion — so any admin of any brand could review any application by
// id. Reviewing is not a read: the accept path cancels that application's
// invoices and rewrites its registration payment status.
//
// Driven through the real HTTP layer rather than by calling the method, because
// the defect was the absence of a guard and only the wired stack proves one is
// there now.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ApplicationsController } from './applications.controller';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { UserRole } from '@core/entities/user.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';
import { CreateApplicationHandler } from '../application/commands/handlers/create-application.handler';
import { UpdateApplicationHandler } from '../application/commands/handlers/update-application.handler';
import { SubmitApplicationHandler } from '../application/commands/handlers/submit-application.handler';
import { ReviewApplicationHandler } from '../application/commands/handlers/review-application.handler';
import { WithdrawApplicationHandler } from '../application/commands/handlers/withdraw-application.handler';
import { SwitchApplicationCategoryHandler } from '../application/commands/handlers/switch-application-category.handler';
import { CreateRegistrationPaymentIntentHandler } from '../application/commands/handlers/create-registration-payment-intent.handler';
import { AdminUpdateSubmissionHandler } from '../application/commands/handlers/admin-update-submission.handler';
import { GetApplicationHandler } from '../application/queries/handlers/get-application.handler';
import { ListApplicationsHandler } from '../application/queries/handlers/list-applications.handler';
import { ExportApplicationsHandler } from '../application/queries/handlers/export-applications.handler';
import { GetApplicationEditHistoryHandler } from '../application/queries/handlers/get-application-edit-history.handler';
import { GetApplicationReviewHandler } from '../application/queries/handlers/get-application-review.handler';
import { UpsertApplicationReviewHandler } from '../application/commands/handlers/upsert-application-review.handler';
import { RegistrationFeeMismatchesHandler } from '../application/queries/handlers/registration-fee-mismatches.handler';
import { ReviewDocumentHandler } from '../application/commands/handlers/review-document.handler';
import { GetDocumentReviewQueueHandler } from '../application/queries/handlers/get-document-review-queue.handler';

const noop = { execute: jest.fn() };

/**
 * An admin assigned to ONE programme, and an application belonging to a
 * DIFFERENT one. That divergence is the entire finding.
 */
// Default grant: every write permission the admin routes ask for, so the scope
// cases below test scope alone. The permission cases pass their own.
const ALL_WRITE_PERMISSIONS = ['applications:write', 'review:write', 'payments:write'];

function buildReadPrisma(opts: {
  adminProgramId: string;
  applicationProgramId: string | null;
  permissions?: string[];
  accessLevel?: number;
}) {
  return {
    admin: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-1',
        accessLevel: opts.accessLevel ?? 1,
        canManageAdmins: false,
        canAssignRoles: false,
        customPermissions: null,
        role: null,
        // No brand grant: this is the program-scoped ('assigned') persona.
        adminBrands: [],
        adminPrograms: [{
          programId: opts.adminProgramId,
          permissions: opts.permissions ?? ALL_WRITE_PERMISSIONS,
          program: { id: opts.adminProgramId, brandId: 'brand-1' },
        }],
      }),
    },
    participantApplication: {
      findUnique: jest.fn().mockResolvedValue(
        opts.applicationProgramId ? { programId: opts.applicationProgramId } : null,
      ),
    },
    program: {
      findUnique: jest.fn().mockResolvedValue({
        id: opts.applicationProgramId,
        brandId: 'brand-2',
        name: 'Someone else\'s programme',
        deletedAt: null,
      }),
    },
  };
}

async function bootstrap(
  readPrisma: unknown,
  reviewHandler: { execute: jest.Mock },
  editHistoryHandler: { execute: jest.Mock } | typeof noop = noop,
  overrides: Array<[unknown, unknown]> = [],
) {
  let builder = Test.createTestingModule({
    controllers: [ApplicationsController],
    providers: [
      { provide: CreateApplicationHandler, useValue: noop },
      { provide: UpdateApplicationHandler, useValue: noop },
      { provide: SubmitApplicationHandler, useValue: noop },
      { provide: ReviewApplicationHandler, useValue: reviewHandler },
      { provide: WithdrawApplicationHandler, useValue: noop },
      { provide: SwitchApplicationCategoryHandler, useValue: noop },
      { provide: CreateRegistrationPaymentIntentHandler, useValue: noop },
      { provide: AdminUpdateSubmissionHandler, useValue: noop },
      { provide: GetApplicationHandler, useValue: noop },
      { provide: ListApplicationsHandler, useValue: noop },
      { provide: ExportApplicationsHandler, useValue: noop },
      { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn() } },
      { provide: PrismaReadService, useValue: readPrisma },
      { provide: GetApplicationReviewHandler, useValue: noop },
      { provide: UpsertApplicationReviewHandler, useValue: noop },
      { provide: RegistrationFeeMismatchesHandler, useValue: noop },
      { provide: ReviewDocumentHandler, useValue: noop },
      { provide: GetDocumentReviewQueueHandler, useValue: noop },
      { provide: GetApplicationEditHistoryHandler, useValue: editHistoryHandler },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: import('@nestjs/common').ExecutionContext) => {
        context.switchToHttp().getRequest().user = {
          userId: 'user-1',
          adminId: 'admin-1',
          role: [UserRole.ADMIN],
        };
        return true;
      },
    })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true });
  for (const [token, value] of overrides) {
    builder = builder.overrideProvider(token).useValue(value);
  }
  const module: TestingModule = await builder.compile();

  const app = module.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}

describe('POST /applications/:id/review is scoped to the application\'s programme', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('REGRESSION: refuses an admin whose programmes do not include the application\'s', async () => {
    // Against the pre-change controller this returns 200 and the handler runs,
    // because the route had no scope check of any kind.
    const reviewHandler = { execute: jest.fn().mockResolvedValue({ id: 'app-1' }) };
    app = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: 'program-B' }),
      reviewHandler,
    );

    await request(app.getHttpServer())
      .post('/applications/app-1/review')
      .send({ status: 'accepted' })
      .expect(404);

    // The stronger half: the review must not merely fail to persist, it must
    // never reach the handler at all. The accept path cancels invoices.
    expect(reviewHandler.execute).not.toHaveBeenCalled();
  });

  it('answers 404, not 403, so the status cannot be used as a cross-brand existence oracle', async () => {
    // The SAME id must answer identically whether the application does not
    // exist or simply is not yours — comparing two different ids would only
    // prove the messages embed their own id. Same rule N23 applied to
    // programme ids.
    const missing = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: null }),
      { execute: jest.fn() },
    );
    const missingRes = await request(missing.getHttpServer())
      .post('/applications/app-1/review')
      .send({ status: 'accepted' });
    await missing.close();

    app = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: 'program-B' }),
      { execute: jest.fn() },
    );
    const outOfScope = await request(app.getHttpServer())
      .post('/applications/app-1/review')
      .send({ status: 'accepted' });

    expect(missingRes.status).toBe(404);
    expect(outOfScope.status).toBe(404);
    expect(outOfScope.body.message).toBe(missingRes.body.message);
  });

  it('still lets an admin review an application in a programme they hold', async () => {
    // The check must not lock out the people it is meant to admit — the #149
    // lockout came from exactly this persona having no fixture.
    const reviewHandler = { execute: jest.fn().mockResolvedValue({ id: 'app-1' }) };
    app = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: 'program-A' }),
      reviewHandler,
    );

    await request(app.getHttpServer())
      .post('/applications/app-1/review')
      .send({ status: 'accepted' })
      .expect(200);

    expect(reviewHandler.execute).toHaveBeenCalled();
  });
});

describe('GET /applications/:id/edit-history is scoped to the application\'s programme', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('refuses an admin outside the application\'s programme without reaching the handler', async () => {
    const history = { execute: jest.fn() };
    app = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: 'program-B' }),
      { execute: jest.fn() },
      history,
    );

    await request(app.getHttpServer()).get('/applications/app-1/edit-history').expect(404);
    expect(history.execute).not.toHaveBeenCalled();
  });

  it('passes the handler plain array through for an in-scope admin', async () => {
    const history = { execute: jest.fn().mockResolvedValue([{ id: 'h1' }]) };
    app = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: 'program-A' }),
      { execute: jest.fn() },
      history,
    );

    const res = await request(app.getHttpServer()).get('/applications/app-1/edit-history').expect(200);
    expect(res.body).toEqual([{ id: 'h1' }]);
    expect(history.execute).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 'app-1' }));
  });
});

// The same rule on every other admin route that takes an application id (and
// on create, which takes the programme id itself). Before this, each carried
// only JwtAuthGuard + @Roles, so an admin scoped to programme A could read,
// edit, submit, withdraw, score or bill any application in any brand.
describe('admin application routes are scoped to the application\'s programme', () => {
  const UUID = '0b3f9c1e-5f4a-4b8e-9c2d-1a2b3c4d5e6f';
  const routes: Array<{
    name: string;
    handler: unknown;
    send: (server: Parameters<typeof request>[0]) => request.Test;
  }> = [
    { name: 'GET /applications/:id', handler: GetApplicationHandler, send: (s) => request(s).get('/applications/app-1') },
    { name: 'PUT /applications/:id', handler: UpdateApplicationHandler, send: (s) => request(s).put('/applications/app-1').send({}) },
    { name: 'POST /applications/:id/switch-category', handler: SwitchApplicationCategoryHandler, send: (s) => request(s).post('/applications/app-1/switch-category').send({ targetCategory: 'self_funded' }) },
    { name: 'POST /applications/:id/submit', handler: SubmitApplicationHandler, send: (s) => request(s).post('/applications/app-1/submit').send({ participantId: 'p-1' }) },
    { name: 'PATCH /applications/:id/submission-data', handler: AdminUpdateSubmissionHandler, send: (s) => request(s).patch('/applications/app-1/submission-data').send({ reason: 'typo' }) },
    { name: 'POST /applications/:id/payment-intent', handler: CreateRegistrationPaymentIntentHandler, send: (s) => request(s).post('/applications/app-1/payment-intent').send({ userId: 'p-1' }) },
    { name: 'GET /applications/:id/review', handler: GetApplicationReviewHandler, send: (s) => request(s).get('/applications/app-1/review?stage=application') },
    { name: 'PUT /applications/:id/review', handler: UpsertApplicationReviewHandler, send: (s) => request(s).put('/applications/app-1/review?stage=application').send({ status: 'draft', items: [] }) },
    { name: 'POST /applications/:id/withdraw', handler: WithdrawApplicationHandler, send: (s) => request(s).post('/applications/app-1/withdraw') },
  ];

  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it.each(routes)('$name: 404 for an admin outside the programme, handler never runs', async ({ handler, send }) => {
    const target = { execute: jest.fn().mockResolvedValue({ id: 'app-1' }) };
    app = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: 'program-B' }),
      { execute: jest.fn() },
      noop,
      [[handler, target]],
    );

    const res = await send(app.getHttpServer());
    expect(res.status).toBe(404);
    expect(target.execute).not.toHaveBeenCalled();
  });

  it('POST /applications: 403 for any non-platform admin, even inside their programme', async () => {
    const target = { execute: jest.fn().mockResolvedValue({ id: 'app-1' }) };
    app = await bootstrap(
      buildReadPrisma({ adminProgramId: UUID, applicationProgramId: UUID }),
      { execute: jest.fn() },
      noop,
      [[CreateApplicationHandler, target]],
    );

    const res = await request(app.getHttpServer()).post('/applications').send({ participantId: UUID, programId: UUID });
    expect(res.status).toBe(403);
    expect(target.execute).not.toHaveBeenCalled();
  });

  it.each(routes)('$name: passes for an admin holding the programme', async ({ handler, send }) => {
    const target = { execute: jest.fn().mockResolvedValue({ id: 'app-1' }) };
    app = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: 'program-A' }),
      { execute: jest.fn() },
      noop,
      [[handler, target]],
    );

    const res = await send(app.getHttpServer());
    expect(res.status).toBeLessThan(300);
    expect(target.execute).toHaveBeenCalled();
  });
});

// Role permissions inside the admin's own programme. Scope (404) is above;
// this is "may they do THIS" (403), checked before the handler runs.
describe('admin application write routes require a write permission', () => {
  const writeRoutes: Array<{
    name: string;
    handler: unknown;
    anyOf: string[];
    send: (server: Parameters<typeof request>[0]) => request.Test;
  }> = [
    { name: 'PUT /applications/:id', handler: UpdateApplicationHandler, anyOf: ['applications:write'], send: (s) => request(s).put('/applications/app-1').send({}) },
    { name: 'POST /applications/:id/switch-category', handler: SwitchApplicationCategoryHandler, anyOf: ['review:write', 'applications:write'], send: (s) => request(s).post('/applications/app-1/switch-category').send({ targetCategory: 'self_funded' }) },
    { name: 'POST /applications/:id/submit', handler: SubmitApplicationHandler, anyOf: ['applications:write', 'payments:write'], send: (s) => request(s).post('/applications/app-1/submit').send({ participantId: 'p-1' }) },
    { name: 'PATCH /applications/:id/submission-data', handler: AdminUpdateSubmissionHandler, anyOf: ['applications:write'], send: (s) => request(s).patch('/applications/app-1/submission-data').send({ reason: 'typo' }) },
    { name: 'POST /applications/:id/payment-intent', handler: CreateRegistrationPaymentIntentHandler, anyOf: ['applications:write', 'payments:write'], send: (s) => request(s).post('/applications/app-1/payment-intent').send({ userId: 'p-1' }) },
    { name: 'PUT /applications/:id/review', handler: UpsertApplicationReviewHandler, anyOf: ['review:write', 'applications:write'], send: (s) => request(s).put('/applications/app-1/review?stage=application').send({ status: 'draft', items: [] }) },
    { name: 'POST /applications/:id/review', handler: ReviewApplicationHandler, anyOf: ['review:write', 'applications:write'], send: (s) => request(s).post('/applications/app-1/review').send({ status: 'accepted' }) },
    { name: 'POST /applications/:id/withdraw', handler: WithdrawApplicationHandler, anyOf: ['applications:write'], send: (s) => request(s).post('/applications/app-1/withdraw') },
  ];

  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  async function run(route: (typeof writeRoutes)[number], opts: { permissions: string[]; accessLevel?: number }) {
    const target = { execute: jest.fn().mockResolvedValue({ id: 'app-1' }) };
    app = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: 'program-A', ...opts }),
      target,
      noop,
      [[route.handler, target]],
    );
    const res = await route.send(app.getHttpServer());
    return { res, target };
  }

  it.each(writeRoutes)('$name: 403 for an in-scope admin with read permissions only, handler never runs', async (route) => {
    const { res, target } = await run(route, { permissions: ['applications:read', 'review:read', 'payments:read', 'participants:write'] });
    expect(res.status).toBe(403);
    expect(target.execute).not.toHaveBeenCalled();
  });

  const routePermissionPairs = writeRoutes.flatMap((route) =>
    route.anyOf.map((permission) => ({ name: route.name, permission, route })),
  );

  it.each(routePermissionPairs)('$name: passes for an in-scope admin holding $permission', async ({ route, permission }) => {
    const { res, target } = await run(route, { permissions: [permission] });
    expect(res.status).toBeLessThan(300);
    expect(target.execute).toHaveBeenCalled();
  });

  it.each(writeRoutes)('$name: a platform-tier admin without the permission passes', async (route) => {
    const { res, target } = await run(route, { permissions: [], accessLevel: 5 });
    expect(res.status).toBeLessThan(300);
    expect(target.execute).toHaveBeenCalled();
  });

  it('read routes stay open to an in-scope admin without write permissions', async () => {
    const target = { execute: jest.fn().mockResolvedValue({ id: 'app-1' }) };
    app = await bootstrap(
      buildReadPrisma({ adminProgramId: 'program-A', applicationProgramId: 'program-A', permissions: [] }),
      { execute: jest.fn() },
      noop,
      [[GetApplicationHandler, target]],
    );
    await request(app.getHttpServer()).get('/applications/app-1').expect(200);
    expect(target.execute).toHaveBeenCalled();
  });
});
