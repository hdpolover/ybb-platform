import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ParticipantsModule } from '../participants/participants.module';
import { FilesModule } from '../files/files.module';
import { AdminsModule } from '../admins/admins.module';
import { MetricsCoreModule } from '@shared/infrastructure/monitoring/metrics-core.module';
import { PaymentsController } from './presentation/payments.controller';
import { PaymentAdminController } from './presentation/payment-admin.controller';
import { GatewayAdminController } from './presentation/gateway-admin.controller';
import { PaymentEventsController } from './presentation/payment-events.controller';
import { PaymentReconciliationController } from './presentation/payment-reconciliation.controller';
import { WebhooksController } from './presentation/webhooks.controller';
import { PaymentRepository } from './infrastructure/persistence/payment.repository';
import { PaymentServiceHttpClient } from './infrastructure/services/payment-service-http.client';
import { PaymentGatewayClient } from './infrastructure/services/payment-gateway.client';
import { ListUserPaymentsHandler } from './application/queries/handlers/list-user-payments.handler';
import { GetPaymentDetailHandler } from './application/queries/handlers/get-payment-detail.handler';
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
        AdminsModule,
        // N-2026-09-10-H: MetricsCoreModule, NOT the full MonitoringModule. This module only
        // injects MetricsService, but MonitoringModule also carries
        // QueueMonitoringService (its own AMQP connection + 15s poll loop) and
        // MetricsMiddleware (an Express middleware with no routes to attach to in a
        // microservice-only app). The RMQ consumer bootstraps import this module
        // transitively, so pulling in the full surface here handed four consumer
        // containers their own queue pollers - the exact fan-out prisma.module.ts was
        // narrowed to prevent. Observed live: "Queue Monitoring Connected" four times
        // in one production container.
        MetricsCoreModule,
        HttpModule.register({
            timeout: 15000, // bound calls to the Go payment service — no timeout meant a hung request never returned
            maxRedirects: 0,
        }),
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
        PaymentGatewayClient,
        ListUserPaymentsHandler,
        GetPaymentDetailHandler,
        ProcessPaymentHandler,
        PaymentOutboxService,
        PaymentReconciliationService,
        RegistrationFeeGateService,
    ],
    exports: ['IPaymentRepository', PaymentServiceHttpClient, PaymentGatewayClient, PaymentOutboxService, RegistrationFeeGateService],
})
export class PaymentsModule { }
