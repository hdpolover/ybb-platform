import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ParticipantsModule } from '../participants/participants.module';
import { FilesModule } from '../files/files.module';
import { MonitoringModule } from '@shared/infrastructure/monitoring/monitoring.module';
import { PaymentsController } from './presentation/payments.controller';
import { PaymentAdminController } from './presentation/payment-admin.controller';
import { GatewayAdminController } from './presentation/gateway-admin.controller';
import { PaymentEventsController } from './presentation/payment-events.controller';
import { PaymentReconciliationController } from './presentation/payment-reconciliation.controller';
import { WebhooksController } from './presentation/webhooks.controller';
import { PaymentRepository } from './infrastructure/persistence/payment.repository';
import { PaymentServiceHttpClient } from './infrastructure/services/payment-service-http.client';
import { ListUserPaymentsHandler } from './application/queries/handlers/list-user-payments.handler';
import { GetPaymentDetailHandler } from './application/queries/handlers/get-payment-detail.handler';
import { CreateIntentHandler } from './application/commands/handlers/create-intent.handler';
import { ProcessPaymentHandler } from './application/commands/handlers/process-payment.handler';
import { PaymentOutboxService } from './infrastructure/services/payment-outbox.service';
import { PaymentReconciliationService } from './infrastructure/services/payment-reconciliation.service';
import { RegistrationFeeGateService } from './application/services/registration-fee-gate.service';

import { CacheModule } from '@shared/infrastructure/cache/cache.module';

@Module({
    imports: [
        CqrsModule,
        AuthModule,
        ParticipantsModule,
        FilesModule,
        MonitoringModule,
        HttpModule,
        ConfigModule,
        CacheModule,
    ],
    controllers: [PaymentsController, PaymentAdminController, GatewayAdminController, PaymentEventsController, PaymentReconciliationController, WebhooksController],
    providers: [
        {
            provide: 'IPaymentRepository',
            useClass: PaymentRepository,
        },
        PaymentRepository,
        PaymentServiceHttpClient,
        ListUserPaymentsHandler,
        GetPaymentDetailHandler,
        CreateIntentHandler,
        ProcessPaymentHandler,
        PaymentOutboxService,
        PaymentReconciliationService,
        RegistrationFeeGateService,
    ],
    exports: ['IPaymentRepository', PaymentServiceHttpClient, PaymentOutboxService, RegistrationFeeGateService],
})
export class PaymentsModule { }
