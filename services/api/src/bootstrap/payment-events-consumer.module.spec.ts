// src/bootstrap/payment-events-consumer.module.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentEventsConsumerModule } from './payment-events-consumer.module';
import { PaymentEventsController } from '@modules/payments/presentation/payment-events.controller';
import { AuditController } from '@modules/audit/audit.controller';
import { ReportingController } from '@modules/reporting/reporting.controller';
import { RedisPubSubService } from '@shared/infrastructure/redis/redis-pubsub.service';

describe('PaymentEventsConsumerModule', () => {
  let moduleRef: TestingModule;

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves PaymentEventsController and excludes foreign event controllers', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PaymentEventsConsumerModule],
    }).compile();

    expect(moduleRef.get(PaymentEventsController, { strict: false })).toBeDefined();
    expect(() => moduleRef.get(AuditController, { strict: false })).toThrow();
    expect(() => moduleRef.get(ReportingController, { strict: false })).toThrow();
  });

  it('still carries RedisPubSubService (M219 trimmed it from ConsumerInfraModule, NOT from here)', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PaymentEventsConsumerModule],
    }).compile();

    // payment-events.controller.ts uses RedisPubSubService to broadcast portal
    // cache invalidation to other instances after a payment settles. It reaches
    // this container via PaymentsModule -> CacheModule (full), independent of
    // ConsumerInfraModule, which now only provides CacheCoreModule. This test
    // pins that the M219 trim of the other four "thin" consumers did not also
    // strip the one consumer that genuinely needs it.
    expect(moduleRef.get(RedisPubSubService, { strict: false })).toBeDefined();
  });
});
