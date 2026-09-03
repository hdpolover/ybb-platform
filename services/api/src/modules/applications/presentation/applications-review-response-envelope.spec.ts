// services/api/src/modules/applications/presentation/applications-review-response-envelope.spec.ts
//
// Regression coverage for a production outage: ApplicationReviewResponseDto used to have a
// field named `items` (the per-criterion score items). The GLOBAL TransformInterceptor
// (see shared/interceptors/transform.interceptor.ts, rule 2) treats ANY response object
// with an `items` array as a paginated-list envelope: it moves that array into the
// envelope's `data` and shoves every other field (rubric, gate, totalScore, ...) into
// `meta`. Every prior test for these handlers asserted the handler's raw return value
// directly, so nothing ever exercised the interceptor and this collision shipped to prod.
//
// This suite boots a real Nest application with TransformInterceptor registered exactly
// as main.ts registers it, and asserts on the actual HTTP response body.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@core/entities/user.entity';
import { ApplicationsController } from './applications.controller';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';
import { TransformInterceptor } from '@shared/interceptors/transform.interceptor';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

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
import { GetApplicationReviewHandler } from '../application/queries/handlers/get-application-review.handler';
import { UpsertApplicationReviewHandler } from '../application/commands/handlers/upsert-application-review.handler';
import { RegistrationFeeMismatchesHandler } from '../application/queries/handlers/registration-fee-mismatches.handler';

const noopHandler = { execute: jest.fn() };

// A realistic ApplicationReviewResponseDto payload: it must include a populated
// rubric.categories so the test can prove the admin dashboard's `review.rubric.categories`
// read survives the interceptor, not just that some object landed in `data`.
function makeReviewResponse() {
  return {
    id: 'review-1',
    applicationId: 'app-1',
    stage: 'application',
    schemaId: 'schema-1',
    schemaVersion: 1,
    status: 'draft',
    totalScore: 42.5,
    notes: null,
    scoreItems: [{ criterionId: 'crit-1', score: 85, notes: null }],
    rubric: {
      id: 'schema-1',
      version: 1,
      categories: [{ id: 'cat-1', name: 'Essay', weight: 1, criteria: [] }],
    },
    gate: { isOpen: true, reason: 'open', applicationTotal: null, applicationThreshold: null },
    hasNewerRubricVersion: false,
  };
}

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

describe('ApplicationsController review routes (through the real TransformInterceptor)', () => {
  let app: INestApplication;
  const mockGetReviewHandler = { execute: jest.fn() };
  const mockUpsertReviewHandler = { execute: jest.fn() };

  beforeAll(async () => {
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
          req.user = { userId: 'user-1', adminId: 'admin-1', role: [UserRole.ADMIN] };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    // Mirrors main.ts: filter, validation pipe, and (the part every prior review test
    // skipped) the global TransformInterceptor that wraps every response.
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /applications/:applicationId/review: the review lands in data with a readable rubric.categories, and is not shredded into meta', async () => {
    mockGetReviewHandler.execute.mockResolvedValue(makeReviewResponse());

    const response = await request(app.getHttpServer())
      .get('/applications/app-1/review')
      .query({ stage: 'application' })
      .expect(200);

    // The shredding bug put the review's fields under `meta` and `data` became `[]`
    // (the domain field that used to be named `items`, now scoreItems, was empty coming
    // out of the interceptor's own `items` detection since our field is renamed).
    expect(Array.isArray(response.body.data)).toBe(false);
    expect(response.body.data.id).toBe('review-1');
    expect(response.body.data.totalScore).toBe(42.5);
    expect(response.body.data.rubric.categories).toHaveLength(1);
    expect(response.body.data.rubric.categories[0].name).toBe('Essay');
    expect(response.body.data.scoreItems).toEqual([{ criterionId: 'crit-1', score: 85, notes: null }]);
    expect(response.body.data.gate).toEqual({
      isOpen: true,
      reason: 'open',
      applicationTotal: null,
      applicationThreshold: null,
    });
    expect(response.body.meta).toBeUndefined();
  });

  it('PUT /applications/:applicationId/review: the saved review lands in data with a readable rubric.categories, and is not shredded into meta', async () => {
    mockUpsertReviewHandler.execute.mockResolvedValue(makeReviewResponse());

    const response = await request(app.getHttpServer())
      .put('/applications/app-1/review')
      .query({ stage: 'application' })
      .send({ status: 'draft', items: [{ criterionId: 'crit-1', score: 85 }] })
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(false);
    expect(response.body.data.id).toBe('review-1');
    expect(response.body.data.rubric.categories).toHaveLength(1);
    expect(response.body.data.scoreItems).toEqual([{ criterionId: 'crit-1', score: 85, notes: null }]);
    expect(response.body.meta).toBeUndefined();
  });
});
