// src/bootstrap/audit-consumer.module.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuditConsumerModule } from './audit-consumer.module';
import { AuditController } from '@modules/audit/audit.controller';
import { ReportingController } from '@modules/reporting/reporting.controller';
import { PaymentEventsController } from '@modules/payments/presentation/payment-events.controller';

describe('AuditConsumerModule', () => {
  let moduleRef: TestingModule;

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves AuditController and excludes foreign event controllers', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AuditConsumerModule],
    }).compile();

    expect(moduleRef.get(AuditController, { strict: false })).toBeDefined();
    expect(() => moduleRef.get(ReportingController, { strict: false })).toThrow();
    expect(() => moduleRef.get(PaymentEventsController, { strict: false })).toThrow();
  });
});
