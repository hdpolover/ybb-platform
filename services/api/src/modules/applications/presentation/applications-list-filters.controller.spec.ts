// services/api/src/modules/applications/presentation/applications-list-filters.controller.spec.ts
//
// Covers the finalist/not_selected scoreStatus filter bug: when those two values were added
// to the Prisma ScoreStatus enum, the domain ScoreStatus enum in
// @core/entities/participant-application.entity (and ApplicationsController.SCORE_STATUS_VALUES,
// which is built from it) were not updated, so GET /applications?scoreStatus=finalist 400'd.
// Kept as its own spec file, mirroring applications-review-endpoints.controller.spec.ts, rather
// than piling onto a monolithic applications.controller.spec.ts that does not yet exist.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@core/entities/user.entity';
import { ApplicationsController } from './applications.controller';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';
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
    {
      provide: PrismaReadService,
      useValue:
        overrides.readPrisma ??
        // Platform-scope admin: AdminScopeGuard / resolveScopedFilters must leave
        // the caller's brand/program filters exactly as supplied.
        { admin: { findUnique: jest.fn().mockResolvedValue({ accessLevel: 10, canManageAdmins: true, canAssignRoles: true, customPermissions: [], role: { name: 'super admin', permissions: ['*'] }, adminBrands: [], adminPrograms: [] }) } },
    },
    { provide: GetApplicationReviewHandler, useValue: overrides.getApplicationReviewHandler ?? noopHandler },
    { provide: UpsertApplicationReviewHandler, useValue: overrides.upsertApplicationReviewHandler ?? noopHandler },
    { provide: RegistrationFeeMismatchesHandler, useValue: overrides.registrationFeeMismatchesHandler ?? noopHandler },
  ];
}

describe('ApplicationsController GET /applications scoreStatus filter', () => {
  let app: INestApplication;
  const mockListApplicationsHandler = { execute: jest.fn() };
  const mockExportApplicationsHandler = { execute: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: buildProviders({
        listApplicationsHandler: mockListApplicationsHandler,
        exportApplicationsHandler: mockExportApplicationsHandler,
      }),
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: 'admin-1', adminId: 'admin-1', role: [UserRole.ADMIN] };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockListApplicationsHandler.execute.mockResolvedValue({ applications: [], total: 0 });
    mockExportApplicationsHandler.execute.mockResolvedValue(Buffer.from(''));
  });

  it.each(['pending', 'scored', 'go_to_interview', 'rejected', 'finalist', 'not_selected'])(
    'GET /applications?scoreStatus=%s does not 400',
    async (scoreStatus) => {
      const response = await request(app.getHttpServer()).get('/applications').query({ scoreStatus });

      expect(response.status).not.toBe(400);
      expect(mockListApplicationsHandler.execute).toHaveBeenCalledTimes(1);
    },
  );

  it('GET /applications?scoreStatus=finalist reaches the handler with scoreStatus intact', async () => {
    await request(app.getHttpServer()).get('/applications').query({ scoreStatus: 'finalist' }).expect(200);

    const query = mockListApplicationsHandler.execute.mock.calls[0][0];
    expect(query.filters.scoreStatus).toBe('finalist');
  });

  it('GET /applications?scoreStatus=not_selected reaches the handler with scoreStatus intact', async () => {
    await request(app.getHttpServer()).get('/applications').query({ scoreStatus: 'not_selected' }).expect(200);

    const query = mockListApplicationsHandler.execute.mock.calls[0][0];
    expect(query.filters.scoreStatus).toBe('not_selected');
  });

  it('GET /applications?scoreStatus=bogus-value still returns 400 (the whitelist is not simply removed)', async () => {
    const response = await request(app.getHttpServer()).get('/applications').query({ scoreStatus: 'bogus-value' });
    expect(response.status).toBe(400);
    expect(mockListApplicationsHandler.execute).not.toHaveBeenCalled();
  });
});

describe('ApplicationsController GET /applications admin scope', () => {
  let app: INestApplication;
  const mockListApplicationsHandler = { execute: jest.fn() };
  // Admin assigned to exactly one brand, mirroring an admin_brands row.
  const brandScopedAdmin = {
    admin: {
      findUnique: jest.fn().mockResolvedValue({
        accessLevel: 1,
        canManageAdmins: false,
        canAssignRoles: false,
        customPermissions: [],
        role: { name: 'admin', permissions: [] },
        adminBrands: [{ brandId: 'brand-mine', permissions: [] }],
        adminPrograms: [],
      }),
    },
    participantApplication: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: buildProviders({
        listApplicationsHandler: mockListApplicationsHandler,
        readPrisma: brandScopedAdmin,
      }),
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: 'admin-1', adminId: 'admin-1', role: [UserRole.ADMIN] };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockListApplicationsHandler.execute.mockClear();
    mockListApplicationsHandler.execute.mockResolvedValue({ applications: [], total: 0 });
  });

  it('rejects a brandId the caller is not assigned to', async () => {
    await request(app.getHttpServer())
      .get('/applications')
      .query({ brandId: 'brand-theirs' })
      .expect(403);

    expect(mockListApplicationsHandler.execute).not.toHaveBeenCalled();
  });

  it('rejects an unfiltered listing rather than serving every brand', async () => {
    await request(app.getHttpServer()).get('/applications').expect(403);

    expect(mockListApplicationsHandler.execute).not.toHaveBeenCalled();
  });

  it('passes the caller’s own brandId straight through', async () => {
    await request(app.getHttpServer()).get('/applications').query({ brandId: 'brand-mine' }).expect(200);

    const query = mockListApplicationsHandler.execute.mock.calls[0][0];
    expect(query.filters.brandId).toBe('brand-mine');
  });
});
