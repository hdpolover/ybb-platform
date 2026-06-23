// src/bootstrap/payment-events-consumer.module.spec.ts
import { Test } from '@nestjs/testing';
import { PaymentEventsConsumerModule } from './payment-events-consumer.module';
import { PaymentEventsController } from '@modules/payments/presentation/payment-events.controller';
import { AuditController } from '@modules/audit/audit.controller';
import { ReportingController } from '@modules/reporting/reporting.controller';

describe('PaymentEventsConsumerModule', () => {
  it('resolves PaymentEventsController and excludes foreign event controllers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PaymentEventsConsumerModule],
    }).compile();

    expect(moduleRef.get(PaymentEventsController, { strict: false })).toBeDefined();
    expect(() => moduleRef.get(AuditController, { strict: false })).toThrow();
    expect(() => moduleRef.get(ReportingController, { strict: false })).toThrow();

    await moduleRef.close();
  });
});
