// services/api/src/modules/applications/presentation/applications-review-endpoints.controller.spec.ts
//
// Task 8b: wires GET/PUT /applications/:applicationId/review. Kept as its own
// spec file (rather than piling onto a monolithic applications.controller.spec.ts
// that does not yet exist) so this task's tests stay scoped to the routes it adds.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { ScoringStage } from '@prisma/client';
import { UserRole } from '@core/entities/user.entity';
import { BadRequestException } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CacheInvalidationInterceptor } from '@shared/interceptors/cache-invalidation.interceptor';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

// Commands/queries this controller already wires (unrelated to this task),
// stubbed so Nest can construct ApplicationsController's full dependency list.
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

// This task's handlers.
import { GetApplicationReviewHandler } from '../application/queries/handlers/get-application-review.handler';
import { UpsertApplicationReviewHandler } from '../application/commands/handlers/upsert-application-review.handler';
import { RegistrationFeeMismatchesHandler } from '../application/queries/handlers/registration-fee-mismatches.handler';
import { GetApplicationReviewQuery } from '../application/queries/get-application-review.query';
import { UpsertApplicationReviewCommand } from '../application/commands/upsert-application-review.command';

const noopHandler = { execute: jest.fn() };

function buildProviders(overrides: Record<string, unknown> = {}) {
  return [
    { provide: CreateApplicationHandler, useValue: overrides.createApplicationHandler ?? noopHandler },
    { provide: UpdateApplicationHandler, useValue: overrides.updateApplicationHandler ?? noopHandler },
    { provide: SubmitApplicationHandler, useValue: overrides.submitApplicationHandler ?? noopHandler },
    { provide: ReviewApplicationHandler, useValue: overrides.reviewApplicationHandler ?? noopHandler },
    { provide: WithdrawApplicationHandler, useValue: overrides.withdrawApplicationHandler ?? noopHandler },
    { provide: SwitchApplicationCategoryHandler, useValue: overrides.switchApplicationCategoryHandler ?? noopHandler },
    { provide: CreateRegistrationPaymentIntentHandler, useValue: overrides.createRegistrationPaymentIntentHandler ?? noopHandler },
    { provide: AdminUpdateSubmissionHandler, useValue: overrides.adminUpdateSubmissionHandler ?? noopHandler },
    { provide: GetApplicationHandler, useValue: overrides.getApplicationHandler ?? noopHandler },
    { provide: ListApplicationsHandler, useValue: overrides.listApplicationsHandler ?? noopHandler },
    { provide: ExportApplicationsHandler, useValue: overrides.exportApplicationsHandler ?? noopHandler },
    { provide: CacheService, useValue: overrides.cacheService ?? { get: jest.fn(), set: jest.fn() } },
    { provide: PrismaReadService, useValue: overrides.readPrisma ?? {} },
    { provide: GetApplicationReviewHandler, useValue: overrides.getApplicationReviewHandler ?? noopHandler },
    { provide: UpsertApplicationReviewHandler, useValue: overrides.upsertApplicationReviewHandler ?? noopHandler },
    { provide: RegistrationFeeMismatchesHandler, useValue: overrides.registrationFeeMismatchesHandler ?? noopHandler },
  ];
}

describe('ApplicationsController review routes (real HTTP layer)', () => {
  let app: INestApplication;
  const mockGetReviewHandler = { execute: jest.fn() };
  const mockUpsertReviewHandler = { execute: jest.fn() };
  const mockReviewApplicationHandler = { execute: jest.fn() };
  let currentUser: { userId: string; adminId?: string; role: string | string[] };

  beforeAll(async () => {
    // userId (users.id) and adminId (admins.id) are deliberately different
    // throughout this suite: ApplicationReview.reviewerId/overrideById are FKs
    // to admins(id), so commands must carry adminId, not userId.
    currentUser = { userId: 'user-1', adminId: 'admin-1', role: [UserRole.ADMIN] };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: buildProviders({
        getApplicationReviewHandler: mockGetReviewHandler,
        upsertApplicationReviewHandler: mockUpsertReviewHandler,
        reviewApplicationHandler: mockReviewApplicationHandler,
      }),
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = currentUser;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    // Mirrors main.ts: global filter + whitelist/forbidNonWhitelisted validation,
    // since this suite's whole point is proving the wiring behaves like production.
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { userId: 'user-1', adminId: 'admin-1', role: [UserRole.ADMIN] };
  });

  describe('route resolution', () => {
    it('GET /applications/:applicationId/review resolves to the review query handler, not the legacy POST :id/review handler', async () => {
      mockGetReviewHandler.execute.mockResolvedValue({ id: null, applicationId: 'app-1', stage: 'application' });

      const response = await request(app.getHttpServer())
        .get('/applications/app-1/review')
        .query({ stage: 'application' })
        .expect(200);

      expect(mockGetReviewHandler.execute).toHaveBeenCalledTimes(1);
      const query: GetApplicationReviewQuery = mockGetReviewHandler.execute.mock.calls[0][0];
      expect(query.applicationId).toBe('app-1');
      expect(query.stage).toBe('application');
      expect(response.body).toEqual({ id: null, applicationId: 'app-1', stage: 'application' });
    });

    it('PUT /applications/:applicationId/review resolves to the upsert review command handler', async () => {
      mockUpsertReviewHandler.execute.mockResolvedValue({ id: 'review-1' });

      await request(app.getHttpServer())
        .put('/applications/app-1/review')
        .query({ stage: 'interview' })
        .send({ status: 'draft', items: [{ criterionId: 'crit-1', score: 10 }] })
        .expect(200);

      expect(mockUpsertReviewHandler.execute).toHaveBeenCalledTimes(1);
      expect(mockGetReviewHandler.execute).not.toHaveBeenCalled();
    });

    it('POST /applications/:id/review (legacy) never reaches the new GET/PUT review handlers', async () => {
      // Task 9 fixed the pre-existing dual-@Body() quirk on this route (see
      // "legacy POST :id/review resolves under the global whitelist pipe"
      // below). What matters here for route-collision purposes is that it
      // never dispatches to either of the new :applicationId/review handlers.
      await request(app.getHttpServer())
        .post('/applications/app-1/review')
        .send({ status: 'accepted', reviewerId: 'admin-1' });

      expect(mockGetReviewHandler.execute).not.toHaveBeenCalled();
      expect(mockUpsertReviewHandler.execute).not.toHaveBeenCalled();
    });

    it('legacy POST :id/review resolves under the global whitelist pipe (Task 9 fixed the dual-@Body() 400)', async () => {
      // Before Task 9, this route bound both @Body() dto and a separate
      // @Body('reviewerId') param, and reviewerId was not a declared
      // property of ReviewApplicationRequestDto, so forbidNonWhitelisted
      // rejected it as an unknown property and every call 400'd. reviewerId
      // is no longer accepted in the body at all (see the attribution test
      // below); a valid body without it must not 400.
      mockReviewApplicationHandler.execute.mockResolvedValue({ id: 'app-1' });

      const response = await request(app.getHttpServer())
        .post('/applications/app-1/review')
        .send({ status: 'accepted', reviewerNotes: 'looks good' });

      expect(response.status).not.toBe(400);
    });

    it('does not let a body-supplied reviewerId determine attribution on POST :id/review (legacy)', async () => {
      // Follow-up fix to the Task 9 change above: declaring reviewerId as a
      // DTO field would have formalized an attribution-forgery hole (any
      // authenticated admin could attribute an approve/reject to a
      // different admin). Same rule Tasks 6/8b applied to
      // createdById/actingAdminId elsewhere in this controller: reviewerId
      // must come from the authenticated JWT principal, not the body.
      mockReviewApplicationHandler.execute.mockResolvedValue({ id: 'app-1' });
      currentUser = { userId: 'real-user-99', adminId: 'real-admin-99', role: [UserRole.ADMIN] };

      const response = await request(app.getHttpServer())
        .post('/applications/app-1/review')
        .send({ status: 'accepted', reviewerId: 'attacker-admin-id' });

      // forbidNonWhitelisted may 400 the request outright since the DTO no
      // longer has a reviewerId field; that is an acceptable pass. Assert
      // the actual observed behavior rather than assuming which one happens.
      if (response.status === 400) {
        expect(mockReviewApplicationHandler.execute).not.toHaveBeenCalled();
        return;
      }

      expect(mockReviewApplicationHandler.execute).toHaveBeenCalledTimes(1);
      const command = mockReviewApplicationHandler.execute.mock.calls[0][0];
      // reviewerId must be the admins.id (real-admin-99), never the
      // users.id (real-user-99) and never the body-supplied attacker id.
      expect(command.reviewerId).toBe('real-admin-99');
      expect(command.reviewerId).not.toBe('real-user-99');
      expect(command.reviewerId).not.toBe('attacker-admin-id');
    });
  });

  describe('stage query param validation', () => {
    it('GET without a stage query param returns 400, not 500 and not a silent default', async () => {
      const response = await request(app.getHttpServer()).get('/applications/app-1/review').expect(400);
      expect(mockGetReviewHandler.execute).not.toHaveBeenCalled();
      expect(response.body.statusCode).toBe(400);
    });

    it('GET with an invalid stage value returns 400', async () => {
      await request(app.getHttpServer())
        .get('/applications/app-1/review')
        .query({ stage: 'not-a-stage' })
        .expect(400);
      expect(mockGetReviewHandler.execute).not.toHaveBeenCalled();
    });

    it('PUT without a stage query param returns 400', async () => {
      await request(app.getHttpServer())
        .put('/applications/app-1/review')
        .send({ status: 'draft', items: [] })
        .expect(400);
      expect(mockUpsertReviewHandler.execute).not.toHaveBeenCalled();
    });

    it('PUT with an invalid stage value returns 400', async () => {
      await request(app.getHttpServer())
        .put('/applications/app-1/review')
        .query({ stage: 'not-a-stage' })
        .send({ status: 'draft', items: [] })
        .expect(400);
      expect(mockUpsertReviewHandler.execute).not.toHaveBeenCalled();
    });
  });

  describe('attribution forgery', () => {
    it('ignores client-supplied actingAdminId/overrideById in the body and uses the authenticated principal', async () => {
      mockUpsertReviewHandler.execute.mockResolvedValue({ id: 'review-1' });
      currentUser = { userId: 'real-user-99', adminId: 'real-admin-99', role: [UserRole.ADMIN] };

      const response = await request(app.getHttpServer())
        .put('/applications/app-1/review')
        .query({ stage: 'application' })
        .send({
          status: 'draft',
          items: [{ criterionId: 'crit-1', score: 10 }],
          actingAdminId: 'attacker-id',
          overrideById: 'attacker-id',
        });

      // forbidNonWhitelisted may 400 the request outright since the DTO has no
      // actingAdminId/overrideById fields; that is an acceptable pass. Assert
      // the actual observed behavior rather than assuming a 200.
      if (response.status === 400) {
        expect(mockUpsertReviewHandler.execute).not.toHaveBeenCalled();
        return;
      }

      expect(response.status).toBe(200);
      expect(mockUpsertReviewHandler.execute).toHaveBeenCalledTimes(1);
      const command: UpsertApplicationReviewCommand = mockUpsertReviewHandler.execute.mock.calls[0][0];
      // actingAdminId must be the admins.id (real-admin-99), never the
      // users.id (real-user-99) and never the body-supplied attacker id.
      expect(command.actingAdminId).toBe('real-admin-99');
      expect(command.actingAdminId).not.toBe('real-user-99');
      expect(command.actingAdminId).not.toBe('attacker-id');
    });

    it('derives actingAdminRole from the authenticated principal, not the request body', async () => {
      mockUpsertReviewHandler.execute.mockResolvedValue({ id: 'review-1' });
      currentUser = { userId: 'user-1', adminId: 'admin-1', role: [UserRole.SUPER_ADMIN] };

      await request(app.getHttpServer())
        .put('/applications/app-1/review')
        .query({ stage: 'interview' })
        .send({ status: 'draft', items: [] })
        .expect(200);

      const command: UpsertApplicationReviewCommand = mockUpsertReviewHandler.execute.mock.calls[0][0];
      expect(command.actingAdminRole).toBe(UserRole.SUPER_ADMIN);
    });
  });

  describe('DTO whitelist rejects server-derived fields', () => {
    it('rejects a body containing totalScore/scoreStatus (server-derived, must not be client-settable)', async () => {
      await request(app.getHttpServer())
        .put('/applications/app-1/review')
        .query({ stage: 'application' })
        .send({ status: 'draft', items: [], totalScore: 999, scoreStatus: 'SCORED' })
        .expect(400);

      expect(mockUpsertReviewHandler.execute).not.toHaveBeenCalled();
    });
  });

  describe('error envelope survives the global HttpExceptionFilter', () => {
    it('preserves the errors[] array from a BadRequestException({ message, errors }) thrown by the handler', async () => {
      mockUpsertReviewHandler.execute.mockRejectedValue(
        new BadRequestException({
          message: 'Review items are invalid.',
          errors: [{ path: 'items[0].score', message: 'Score must be between 0 and 100 for this criterion.' }],
        }),
      );

      const response = await request(app.getHttpServer())
        .put('/applications/app-1/review')
        .query({ stage: 'application' })
        .send({ status: 'draft', items: [{ criterionId: 'crit-1', score: 999 }] })
        .expect(400);

      expect(response.body.errors).toEqual([
        { path: 'items[0].score', message: 'Score must be between 0 and 100 for this criterion.' },
      ]);
    });
  });
});

describe('PUT /applications/:applicationId/review cache invalidation', () => {
  // Separate app instance, wired with the SAME CacheInvalidationInterceptor
  // production uses (CacheModule registers it globally as APP_INTERCEPTOR),
  // rather than asserting on @CacheInvalidate metadata alone. This proves the
  // route actually reaches CacheService.invalidateByPatterns with the right
  // key when it runs, not just that the decorator is present.
  let app: INestApplication;
  const mockUpsertReviewHandler = { execute: jest.fn() };
  const invalidateByPatterns = jest.fn();
  const cacheServiceMock = { get: jest.fn(), set: jest.fn(), invalidateByPatterns };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: buildProviders({
        upsertApplicationReviewHandler: mockUpsertReviewHandler,
        cacheService: cacheServiceMock,
      }),
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: 'user-1', adminId: 'admin-1', role: [UserRole.ADMIN] };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(
      new CacheInvalidationInterceptor(new Reflector(), cacheServiceMock as unknown as CacheService),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates application:list:* after a successful PUT, so the admin list stops serving the pre-review score/status', async () => {
    mockUpsertReviewHandler.execute.mockResolvedValue({ id: 'review-1' });

    await request(app.getHttpServer())
      .put('/applications/app-1/review')
      .query({ stage: 'application' })
      .send({ status: 'submitted', items: [{ criterionId: 'crit-1', score: 10 }] })
      .expect(200);

    // CacheInvalidationInterceptor invalidates inside an async tap() callback
    // that runs after the response observable completes, so it can still be
    // pending when supertest's promise resolves. Flush the microtask/timer
    // queue before asserting.
    await new Promise((resolve) => setImmediate(resolve));

    expect(invalidateByPatterns).toHaveBeenCalledTimes(1);
    expect(invalidateByPatterns).toHaveBeenCalledWith(['application:list:*']);
  });

  it('does not invalidate any cache when the handler throws (no successful write, nothing to invalidate)', async () => {
    mockUpsertReviewHandler.execute.mockRejectedValue(new BadRequestException('Review items are invalid.'));

    await request(app.getHttpServer())
      .put('/applications/app-1/review')
      .query({ stage: 'application' })
      .send({ status: 'draft', items: [] })
      .expect(400);

    await new Promise((resolve) => setImmediate(resolve));

    expect(invalidateByPatterns).not.toHaveBeenCalled();
  });
});
