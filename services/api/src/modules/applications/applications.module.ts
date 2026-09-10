import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { ParticipantsModule } from '@modules/participants/participants.module';
import { ProgramsModule } from '@modules/programs/programs.module';
import { ApplicationsController } from './presentation/applications.controller';
import { PaymentModule } from '@modules/payments/payment.module';
import { PaymentsModule } from '@modules/payments/payments.module';

// Command Handlers
import { CreateApplicationHandler } from './application/commands/handlers/create-application.handler';
import { UpdateApplicationHandler } from './application/commands/handlers/update-application.handler';
import { SubmitApplicationHandler } from './application/commands/handlers/submit-application.handler';
import { ReviewApplicationHandler } from './application/commands/handlers/review-application.handler';
import { WithdrawApplicationHandler } from './application/commands/handlers/withdraw-application.handler';
import { SwitchApplicationCategoryHandler } from './application/commands/handlers/switch-application-category.handler';

import { CreateRegistrationPaymentIntentHandler } from './application/commands/handlers/create-registration-payment-intent.handler';
import { AdminUpdateSubmissionHandler } from './application/commands/handlers/admin-update-submission.handler';
import { UpsertApplicationReviewHandler } from './application/commands/handlers/upsert-application-review.handler';

// Query Handlers
import { GetApplicationHandler } from './application/queries/handlers/get-application.handler';
import { ListApplicationsHandler } from './application/queries/handlers/list-applications.handler';
import { ExportApplicationsHandler } from './application/queries/handlers/export-applications.handler';
import { GetApplicationReviewHandler } from './application/queries/handlers/get-application-review.handler';
import { RegistrationFeeMismatchesHandler } from './application/queries/handlers/registration-fee-mismatches.handler';

// Infrastructure
import { ApplicationRepository } from './infrastructure/persistence/application.repository';
import { ApplicationMapper } from './infrastructure/mappers/application.mapper';
import { SubmissionDeadlineReminderService } from './infrastructure/services/submission-deadline-reminder.service';
import { PostPaymentFollowupService } from './infrastructure/services/post-payment-followup.service';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { MetricsCoreModule } from '@shared/infrastructure/monitoring/metrics-core.module';
import { APPLICATION_REPOSITORY } from './infrastructure/tokens';

import { CacheModule } from '@shared/infrastructure/cache/cache.module';

@Module({
  // N-2026-09-10-H: MetricsCoreModule, NOT the full MonitoringModule. This
  // module only injects MetricsService, but MonitoringModule also carries
  // QueueMonitoringService (its own AMQP connection + 15s poll loop) and
  // MetricsMiddleware (an Express middleware with no routes to attach to in a
  // microservice-only app). The RMQ consumer bootstraps import this module
  // transitively, so pulling in the full surface here handed four consumer
  // containers their own queue pollers - the exact fan-out prisma.module.ts
  // was narrowed to prevent.
  imports: [PrismaModule, AuthModule, ParticipantsModule, ProgramsModule, MetricsCoreModule, PaymentModule, PaymentsModule, CacheModule],
  controllers: [ApplicationsController],
  providers: [
    // Command Handlers
    CreateApplicationHandler,
    UpdateApplicationHandler,
    SubmitApplicationHandler,
    ReviewApplicationHandler,
    WithdrawApplicationHandler,
    SwitchApplicationCategoryHandler,
    CreateRegistrationPaymentIntentHandler,
    AdminUpdateSubmissionHandler,
    UpsertApplicationReviewHandler,

    // Query Handlers
    GetApplicationHandler,
    ListApplicationsHandler,
    ExportApplicationsHandler,
    GetApplicationReviewHandler,
    RegistrationFeeMismatchesHandler,

    // Infrastructure
    ApplicationMapper,
    SubmissionDeadlineReminderService,
    PostPaymentFollowupService,
    {
      provide: APPLICATION_REPOSITORY,
      useClass: ApplicationRepository,
    },
  ],
  exports: [
    CreateApplicationHandler,
    GetApplicationHandler,
    ListApplicationsHandler,
  ],
})
export class ApplicationsModule { }
