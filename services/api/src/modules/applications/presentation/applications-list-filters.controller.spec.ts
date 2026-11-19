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
import { GetApplicationEditHistoryHandler } from '../application/queries/handlers/get-application-edit-history.handler';
import { GetApplicationReviewHandler } from '../application/queries/handlers/get-application-review.handler';
import { UpsertApplicationReviewHandler } from '../application/commands/handlers/upsert-application-review.handler';
import { RegistrationFeeMismatchesHandler } from '../application/queries/handlers/registration-fee-mismatches.handler';
import { ReviewDocumentHandler } from '../application/commands/handlers/review-document.handler';
import { GetDocumentReviewQueueHandler } from '../application/queries/handlers/get-document-review-queue.handler';

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
    { provide: ReviewDocumentHandler, useValue: overrides.reviewDocumentHandler ?? noopHandler },
    { provide: GetDocumentReviewQueueHandler, useValue: overrides.getDocumentReviewQueueHandler ?? noopHandler },
    { provide: GetApplicationEditHistoryHandler, useValue: noopHandler },
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

  it('GET /applications?scoreStatus=a,b,c (comma-separated) reaches the handler as an array', async () => {
    await request(app.getHttpServer())
      .get('/applications')
      .query({ scoreStatus: 'go_to_interview,finalist,not_selected' })
      .expect(200);

    const query = mockListApplicationsHandler.execute.mock.calls[0][0];
    expect(query.filters.scoreStatus).toEqual(['go_to_interview', 'finalist', 'not_selected']);
  });

  it('GET /applications?scoreStatus=a&scoreStatus=b (repeated param) reaches the handler as an array', async () => {
    await request(app.getHttpServer())
      .get('/applications?scoreStatus=go_to_interview&scoreStatus=finalist')
      .expect(200);

    const query = mockListApplicationsHandler.execute.mock.calls[0][0];
    expect(query.filters.scoreStatus).toEqual(['go_to_interview', 'finalist']);
  });

  it('GET /applications 400s when any one of several scoreStatus values is invalid', async () => {
    const response = await request(app.getHttpServer())
      .get('/applications')
      .query({ scoreStatus: 'go_to_interview,bogus-value' });
    expect(response.status).toBe(400);
    expect(mockListApplicationsHandler.execute).not.toHaveBeenCalled();
  });

  it('GET /applications/export?scoreStatus=a,b passes the array to the export query', async () => {
    await request(app.getHttpServer())
      .get('/applications/export')
      .query({ brandId: 'brand-1', scoreStatus: 'go_to_interview,finalist' });

    const query = mockExportApplicationsHandler.execute.mock.calls[0][0];
    expect(query.scoreStatus).toEqual(['go_to_interview', 'finalist']);
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
  const adminRow = (overrides: Record<string, unknown>) => ({
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'admin', permissions: [] },
    adminBrands: [],
    adminPrograms: [],
    ...overrides,
  });
  // Explicit admin_programs row: the only way a non-platform admin reaches a program.
  const assignedAdminRow = adminRow({ adminPrograms: [{ programId: 'prog-mine', permissions: [] }] });
  // admin_brands row only: grants nothing (owner policy 2026-11-19).
  const brandRowOnlyAdminRow = adminRow({ adminBrands: [{ brandId: 'brand-mine', permissions: [] }] });
  const programRows: Record<string, { id: string; brandId: string; name: string; deletedAt: null }> = {
    'prog-mine': { id: 'prog-mine', brandId: 'brand-mine', name: 'Mine', deletedAt: null },
    'prog-theirs': { id: 'prog-theirs', brandId: 'brand-theirs', name: 'Theirs', deletedAt: null },
  };
  const scopedAdmin = {
    admin: { findUnique: jest.fn() },
    program: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => programRows[where.id] ?? null) },
    participantApplication: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: buildProviders({
        listApplicationsHandler: mockListApplicationsHandler,
        readPrisma: scopedAdmin,
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
    scopedAdmin.admin.findUnique.mockResolvedValue(assignedAdminRow);
  });

  it('rejects a brandId filter for a non-platform admin (brand filters are platform-only)', async () => {
    await request(app.getHttpServer())
      .get('/applications')
      .query({ brandId: 'brand-theirs' })
      .expect(403);
    await request(app.getHttpServer()).get('/applications').query({ brandId: 'brand-mine' }).expect(403);

    expect(mockListApplicationsHandler.execute).not.toHaveBeenCalled();
  });

  it('rejects an unfiltered listing rather than serving every program', async () => {
    await request(app.getHttpServer()).get('/applications').expect(403);

    expect(mockListApplicationsHandler.execute).not.toHaveBeenCalled();
  });

  it('rejects a programId the caller is not assigned to', async () => {
    await request(app.getHttpServer()).get('/applications').query({ programId: 'prog-theirs' }).expect(404);

    expect(mockListApplicationsHandler.execute).not.toHaveBeenCalled();
  });

  it('passes the caller’s assigned programId straight through', async () => {
    await request(app.getHttpServer()).get('/applications').query({ programId: 'prog-mine' }).expect(200);

    const query = mockListApplicationsHandler.execute.mock.calls[0][0];
    expect(query.filters.programId).toBe('prog-mine');
  });

  // brand rows grant nothing (owner policy 2026-11-19)
  it('refuses a brand-row-only admin even for a program in their own brand', async () => {
    scopedAdmin.admin.findUnique.mockResolvedValue(brandRowOnlyAdminRow);
    await request(app.getHttpServer()).get('/applications').query({ programId: 'prog-mine' }).expect(404);
    await request(app.getHttpServer()).get('/applications').query({ brandId: 'brand-mine' }).expect(403);

    expect(mockListApplicationsHandler.execute).not.toHaveBeenCalled();
  });
});
