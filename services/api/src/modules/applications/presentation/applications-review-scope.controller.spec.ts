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
import { GetApplicationReviewHandler } from '../application/queries/handlers/get-application-review.handler';
import { UpsertApplicationReviewHandler } from '../application/commands/handlers/upsert-application-review.handler';
import { RegistrationFeeMismatchesHandler } from '../application/queries/handlers/registration-fee-mismatches.handler';

const noop = { execute: jest.fn() };

/**
 * An admin assigned to ONE programme, and an application belonging to a
 * DIFFERENT one. That divergence is the entire finding.
 */
function buildReadPrisma(opts: { adminProgramId: string; applicationProgramId: string | null }) {
  return {
    admin: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-1',
        accessLevel: 1,
        canManageAdmins: false,
        canAssignRoles: false,
        customPermissions: null,
        role: null,
        // No brand grant: this is the program-scoped ('assigned') persona.
        adminBrands: [],
        adminPrograms: [{ programId: opts.adminProgramId, program: { id: opts.adminProgramId, brandId: 'brand-1' } }],
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

async function bootstrap(readPrisma: unknown, reviewHandler: { execute: jest.Mock }) {
  const module: TestingModule = await Test.createTestingModule({
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
    .useValue({ canActivate: () => true })
    .compile();

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
