// services/api/src/modules/readiness/readiness.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PaymentsModule } from '@modules/payments/payments.module';
import { AuthModule } from '@modules/auth/auth.module';
import { ReadinessController } from './presentation/readiness.controller';
import { ReadinessContextLoader } from './infrastructure/readiness-context.loader';
import { ReadinessRepository } from './infrastructure/persistence/readiness.repository';
import { PaymentConfigClient } from './infrastructure/payment-config.client';
import { GetBrandReadinessHandler } from './application/queries/handlers/get-brand-readiness.handler';
import { GetProgramReadinessHandler } from './application/queries/handlers/get-program-readiness.handler';
import { GetReadinessSummaryHandler } from './application/queries/handlers/get-readiness-summary.handler';
import { CreateReadinessOverrideHandler } from './application/commands/handlers/create-readiness-override.handler';
import { ReadinessSnapshotService } from './application/services/readiness-snapshot.service';

@Module({
  imports: [CqrsModule, PaymentsModule, AuthModule],
  controllers: [ReadinessController],
  providers: [
    ReadinessContextLoader,
    ReadinessRepository,
    PaymentConfigClient,
    GetBrandReadinessHandler,
    GetProgramReadinessHandler,
    GetReadinessSummaryHandler,
    CreateReadinessOverrideHandler,
    ReadinessSnapshotService,
  ],
  exports: [ReadinessContextLoader, ReadinessRepository],
})
export class ReadinessModule {}
