// src/bootstrap/payment-events-consumer.module.ts
import { Module } from '@nestjs/common';
import { ConsumerInfraModule } from './consumer-infra.module';
import { PaymentModule } from '@modules/payments/payment.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { MetaModule } from '@modules/meta/meta.module';

// Consumer container for `api-service-payment-events` (bound to payment-events,
// routing key 'payment.#'). Only PaymentEventsController runs here, so
// processApplicationPayment() executes exactly once per delivery.
// PaymentModule provides the @Global PaymentGrpcClient (gRPC transport to Go payment
// service) needed by ProcessPaymentHandler inside PaymentsModule.
// PaymentsModule contains @Cron services (PaymentReconciliationService hourly,
// PaymentOutboxService every 10s); because ConsumerInfraModule omits ScheduleModule
// and neither service injects SchedulerRegistry, those crons do NOT register here.
// They run only in the HTTP app, so the reconciliation and outbox jobs fire once.
// MetaModule is listed explicitly even though it's @Global(): a @Global module's
// providers are only available once it's part of THIS process's module graph —
// this slim consumer bootstraps its own tree rather than the full AppModule, and
// PaymentsModule -> AuthModule eagerly instantiates every AuthModule provider
// (LoginHandler etc.), which now inject MetaCapiService for server-side
// conversion tracking (payment.succeeded -> Purchase/ProgramFeePaid).
@Module({
  imports: [ConsumerInfraModule, PaymentModule, PaymentsModule, MetaModule],
})
export class PaymentEventsConsumerModule {}
