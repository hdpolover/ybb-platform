// src/bootstrap/audit-consumer.module.spec.ts
import { Test } from '@nestjs/testing';
import { AuditConsumerModule } from './audit-consumer.module';
import { AuditController } from '@modules/audit/audit.controller';
import { ReportingController } from '@modules/reporting/reporting.controller';
import { PaymentEventsController } from '@modules/payments/presentation/payment-events.controller';

describe('AuditConsumerModule', () => {
  it('resolves AuditController and excludes foreign event controllers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuditConsumerModule],
    }).compile();

    expect(moduleRef.get(AuditController, { strict: false })).toBeDefined();
    expect(() => moduleRef.get(ReportingController, { strict: false })).toThrow();
    expect(() => moduleRef.get(PaymentEventsController, { strict: false })).toThrow();

    await moduleRef.close();
  });
});
