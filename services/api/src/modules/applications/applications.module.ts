import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { ParticipantsModule } from '@modules/participants/participants.module';
import { ApplicationsController } from './presentation/applications.controller';
import { PaymentModule } from '@modules/payments/payment.module';

// Command Handlers
import { CreateApplicationHandler } from './application/commands/handlers/create-application.handler';
import { UpdateApplicationHandler } from './application/commands/handlers/update-application.handler';
import { SubmitApplicationHandler } from './application/commands/handlers/submit-application.handler';
import { ReviewApplicationHandler } from './application/commands/handlers/review-application.handler';
import { WithdrawApplicationHandler } from './application/commands/handlers/withdraw-application.handler';
import { SwitchApplicationCategoryHandler } from './application/commands/handlers/switch-application-category.handler';

import { CreateRegistrationPaymentIntentHandler } from './application/commands/handlers/create-registration-payment-intent.handler';

// Query Handlers
import { GetApplicationHandler } from './application/queries/handlers/get-application.handler';
import { ListApplicationsHandler } from './application/queries/handlers/list-applications.handler';
import { ExportApplicationsHandler } from './application/queries/handlers/export-applications.handler';

// Infrastructure
import { ApplicationRepository } from './infrastructure/persistence/application.repository';
import { ApplicationMapper } from './infrastructure/mappers/application.mapper';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { MonitoringModule } from '@shared/infrastructure/monitoring/monitoring.module';
import { APPLICATION_REPOSITORY } from './infrastructure/tokens';

import { CacheModule } from '@shared/infrastructure/cache/cache.module';

@Module({
  imports: [PrismaModule, AuthModule, ParticipantsModule, MonitoringModule, PaymentModule, CacheModule],
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

    // Query Handlers
    GetApplicationHandler,
    ListApplicationsHandler,
    ExportApplicationsHandler,

    // Infrastructure
    ApplicationMapper,
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
