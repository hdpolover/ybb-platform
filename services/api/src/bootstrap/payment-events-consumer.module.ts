// src/bootstrap/payment-events-consumer.module.ts
import { Module } from '@nestjs/common';
import { ConsumerInfraModule } from './consumer-infra.module';
import { PaymentModule } from '@modules/payments/payment.module';
import { PaymentsModule } from '@modules/payments/payments.module';

// Consumer container for `api-service-payment-events` (bound to payment-events,
// routing key 'payment.#'). Only PaymentEventsController runs here, so
// processApplicationPayment() executes exactly once per delivery.
// PaymentModule provides the @Global PaymentGrpcClient (gRPC transport to Go payment
// service) needed by CreateIntentHandler inside PaymentsModule.
// PaymentsModule contains @Cron services (PaymentReconciliationService hourly,
// PaymentOutboxService every 10s); because ConsumerInfraModule omits ScheduleModule
// and neither service injects SchedulerRegistry, those crons do NOT register here.
// They run only in the HTTP app, so the reconciliation and outbox jobs fire once.
@Module({
  imports: [ConsumerInfraModule, PaymentModule, PaymentsModule],
})
export class PaymentEventsConsumerModule {}
