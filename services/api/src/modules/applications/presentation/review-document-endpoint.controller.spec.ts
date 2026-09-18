// services/api/src/modules/applications/presentation/review-document-endpoint.controller.spec.ts
//
// Phase 1 of the agreement letter review workflow: wires
// POST /applications/:applicationId/documents/:documentId/review. Kept as its
// own spec file (same rationale as applications-review-endpoints.controller.spec.ts)
// so this task's tests stay scoped to the route it adds, rather than piling onto
// a monolithic applications.controller.spec.ts.
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@core/entities/user.entity';
import { ApplicationsController } from './applications.controller';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
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
import { GetApplicationReviewHandler } from '../application/queries/handlers/get-application-review.handler';
import { UpsertApplicationReviewHandler } from '../application/commands/handlers/upsert-application-review.handler';
import { RegistrationFeeMismatchesHandler } from '../application/queries/handlers/registration-fee-mismatches.handler';
import { ReviewDocumentHandler } from '../application/commands/handlers/review-document.handler';
import { ReviewDocumentCommand } from '../application/commands/review-document.command';

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
    { provide: ReviewDocumentHandler, useValue: overrides.reviewDocumentHandler ?? noopHandler },
  ];
}

describe('POST /applications/:applicationId/documents/:documentId/review', () => {
  let app: INestApplication;
  const mockReviewDocumentHandler = { execute: jest.fn() };
  let currentUser: { userId: string; adminId?: string; role: string | string[] };
  // Set by the JwtAuthGuard override below, mirroring what AdminScopeGuard/
  // getRequestAdminScope would memoize on the request in production. Letting
  // tests set this directly (instead of mocking resolveRevenueAccessScope's
  // full admin_brands/admin_programs query chain) keeps this spec scoped to
  // "does the controller enforce the scope it's given", not "does the scope
  // resolver work" (that's admin-scope.guard.spec.ts's job).
  let adminScope: unknown;
  // readPrisma.participantApplication.findUnique's canned response for the
  // application id under test.
  let applicationProgramId: string | null;

  const mockReadPrisma = {
    participantApplication: {
      findUnique: jest.fn(() => Promise.resolve(applicationProgramId ? { programId: applicationProgramId } : null)),
    },
    program: {
      findUnique: jest.fn(() =>
        Promise.resolve({ id: 'program-1', brandId: 'brand-1', name: 'Test Program', deletedAt: null }),
      ),
    },
  };

  beforeAll(async () => {
    currentUser = { userId: 'user-1', adminId: 'admin-1', role: [UserRole.ADMIN] };
    adminScope = { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };
    applicationProgramId = 'program-1';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: buildProviders({
        reviewDocumentHandler: mockReviewDocumentHandler,
        readPrisma: mockReadPrisma,
      }),
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = currentUser;
          req.adminScope = adminScope;
          return true;
        },
      })
      // RolesGuard is left as the REAL implementation (not stubbed) so the
      // role-rejection test below exercises the actual @Roles() enforcement.
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
    currentUser = { userId: 'user-1', adminId: 'admin-1', role: [UserRole.ADMIN] };
    adminScope = { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };
    applicationProgramId = 'program-1';
  });

  it('dispatches to ReviewDocumentHandler with the JWT-derived admin id, never a body-supplied one', async () => {
    mockReviewDocumentHandler.execute.mockResolvedValue({ id: 'doc-1', submissionStatus: 'approved' });

    await request(app.getHttpServer())
      .post('/applications/app-1/documents/doc-1/review')
      .send({ action: 'approve', reviewerId: 'somebody-elses-admin-id' })
      .expect(400); // forbidNonWhitelisted rejects the unknown reviewerId field

    expect(mockReviewDocumentHandler.execute).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post('/applications/app-1/documents/doc-1/review')
      .send({ action: 'approve' })
      .expect(200);

    const command: ReviewDocumentCommand = mockReviewDocumentHandler.execute.mock.calls[0][0];
    expect(command.applicationId).toBe('app-1');
    expect(command.documentId).toBe('doc-1');
    expect(command.reviewerId).toBe('admin-1');
    expect(command.action).toBe('approve');
  });

  it('rejects a plain PARTICIPANT role with 403 before the handler runs', async () => {
    currentUser = { userId: 'user-2', adminId: undefined, role: ['participant'] };

    await request(app.getHttpServer())
      .post('/applications/app-1/documents/doc-1/review')
      .send({ action: 'approve' })
      .expect(403);

    expect(mockReviewDocumentHandler.execute).not.toHaveBeenCalled();
  });

  it('rejects with 404 when the application belongs to a programme outside the admin\'s scope', async () => {
    adminScope = { kind: 'assigned', allowedBrandIds: [], allowedProgramIds: ['some-other-program'] };
    applicationProgramId = 'program-1'; // not in allowedProgramIds

    await request(app.getHttpServer())
      .post('/applications/app-1/documents/doc-1/review')
      .send({ action: 'approve' })
      .expect(404);

    expect(mockReviewDocumentHandler.execute).not.toHaveBeenCalled();
  });

  it('allows the request through when the application programme is in the admin\'s assigned scope', async () => {
    adminScope = { kind: 'assigned', allowedBrandIds: [], allowedProgramIds: ['program-1'] };
    applicationProgramId = 'program-1';
    mockReviewDocumentHandler.execute.mockResolvedValue({ id: 'doc-1', submissionStatus: 'approved' });

    await request(app.getHttpServer())
      .post('/applications/app-1/documents/doc-1/review')
      .send({ action: 'approve' })
      .expect(200);

    expect(mockReviewDocumentHandler.execute).toHaveBeenCalledTimes(1);
  });

  it('400s when action is reject with no note (DTO-level requirement is enforced in the handler, but a missing action still fails validation)', async () => {
    await request(app.getHttpServer())
      .post('/applications/app-1/documents/doc-1/review')
      .send({})
      .expect(400);

    expect(mockReviewDocumentHandler.execute).not.toHaveBeenCalled();
  });
});
