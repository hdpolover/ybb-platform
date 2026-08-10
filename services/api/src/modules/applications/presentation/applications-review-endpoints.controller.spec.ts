// services/api/src/modules/applications/presentation/applications-review-endpoints.controller.spec.ts
//
// Task 8b: wires GET/PUT /applications/:applicationId/review. Kept as its own
// spec file (rather than piling onto a monolithic applications.controller.spec.ts
// that does not yet exist) so this task's tests stay scoped to the routes it adds.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ScoringStage } from '@prisma/client';
import { UserRole } from '@core/entities/user.entity';
import { BadRequestException } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

// Commands/queries this controller already wires (unrelated to this task) —
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
  ];
}

describe('ApplicationsController review routes (real HTTP layer)', () => {
  let app: INestApplication;
  const mockGetReviewHandler = { execute: jest.fn() };
  const mockUpsertReviewHandler = { execute: jest.fn() };
  let currentUser: { userId: string; role: string | string[] };

  beforeAll(async () => {
    currentUser = { userId: 'admin-1', role: [UserRole.ADMIN] };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: buildProviders({
        getApplicationReviewHandler: mockGetReviewHandler,
        upsertApplicationReviewHandler: mockUpsertReviewHandler,
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
    currentUser = { userId: 'admin-1', role: [UserRole.ADMIN] };
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
      // Whether the legacy route itself 200s is unrelated to this task (it has
      // its own pre-existing DTO/body-shape quirk, out of scope here — the
      // legacy POST :id/review endpoint is slated for cleanup in Task 9). What
      // matters for route-collision purposes is that it never dispatches to
      // either of the new :applicationId/review handlers.
      await request(app.getHttpServer())
        .post('/applications/app-1/review')
        .send({ status: 'accepted', reviewerId: 'admin-1' });

      expect(mockGetReviewHandler.execute).not.toHaveBeenCalled();
      expect(mockUpsertReviewHandler.execute).not.toHaveBeenCalled();
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
      currentUser = { userId: 'real-admin-99', role: [UserRole.ADMIN] };

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
      // actingAdminId/overrideById fields — that is an acceptable pass. Assert
      // the actual observed behavior rather than assuming a 200.
      if (response.status === 400) {
        expect(mockUpsertReviewHandler.execute).not.toHaveBeenCalled();
        return;
      }

      expect(response.status).toBe(200);
      expect(mockUpsertReviewHandler.execute).toHaveBeenCalledTimes(1);
      const command: UpsertApplicationReviewCommand = mockUpsertReviewHandler.execute.mock.calls[0][0];
      expect(command.actingAdminId).toBe('real-admin-99');
      expect(command.actingAdminId).not.toBe('attacker-id');
    });

    it('derives actingAdminRole from the authenticated principal, not the request body', async () => {
      mockUpsertReviewHandler.execute.mockResolvedValue({ id: 'review-1' });
      currentUser = { userId: 'admin-1', role: [UserRole.SUPER_ADMIN] };

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
