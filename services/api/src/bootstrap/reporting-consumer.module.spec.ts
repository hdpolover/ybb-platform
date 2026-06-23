// src/bootstrap/reporting-consumer.module.spec.ts
import { Test } from '@nestjs/testing';
import { ReportingConsumerModule } from './reporting-consumer.module';
import { ReportingController } from '@modules/reporting/reporting.controller';
import { AuditController } from '@modules/audit/audit.controller';
import { PaymentEventsController } from '@modules/payments/presentation/payment-events.controller';

describe('ReportingConsumerModule', () => {
  it('resolves ReportingController and excludes foreign event controllers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ReportingConsumerModule],
    }).compile();

    expect(moduleRef.get(ReportingController, { strict: false })).toBeDefined();
    expect(() => moduleRef.get(AuditController, { strict: false })).toThrow();
    expect(() => moduleRef.get(PaymentEventsController, { strict: false })).toThrow();

    await moduleRef.close();
  });
});
