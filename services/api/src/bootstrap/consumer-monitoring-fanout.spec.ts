// src/bootstrap/consumer-monitoring-fanout.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuditConsumerModule } from './audit-consumer.module';
import { ReportingConsumerModule } from './reporting-consumer.module';
import { PaymentEventsConsumerModule } from './payment-events-consumer.module';
import { LoaEventsConsumerModule } from './loa-events-consumer.module';
import { ReminderEventsConsumerModule } from './reminder-events-consumer.module';
import { QueueMonitoringService } from '@shared/infrastructure/monitoring/queue-monitoring.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';

// N-2026-09-10-H. consumer-infra.module.spec.ts already asserts this same
// property, but it asserts it about ConsumerInfraModule — which never imported
// MonitoringModule in the first place. The five modules below are what
// connectRabbitMqConsumers actually boots, and they reach MonitoringModule
// through the FEATURE modules (payments, auth, applications, files), which the
// existing test does not compile. That gap is why production logged
// "Queue Monitoring Connected" four times in a single container: four consumer
// containers each holding their own AMQP connection and 15s poll loop, setting
// gauges into a prom-client registry nothing scrapes.
//
// Assert it at the level that boots, not at the level that was already clean.
describe('RMQ consumer containers do not carry HTTP-app-only monitoring', () => {
  const consumerModules = [
    ['AuditConsumerModule', AuditConsumerModule],
    ['ReportingConsumerModule', ReportingConsumerModule],
    ['PaymentEventsConsumerModule', PaymentEventsConsumerModule],
    ['LoaEventsConsumerModule', LoaEventsConsumerModule],
    ['ReminderEventsConsumerModule', ReminderEventsConsumerModule],
  ] as const;

  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it.each(consumerModules)('%s does not resolve QueueMonitoringService', async (_name, consumerModule) => {
    moduleRef = await Test.createTestingModule({ imports: [consumerModule] }).compile();

    expect(() => moduleRef!.get(QueueMonitoringService, { strict: false })).toThrow();
  });

  it.each(consumerModules)('%s still resolves MetricsService', async (_name, consumerModule) => {
    // The point is to drop the HTTP-only extras, NOT the metrics every process
    // records through PrismaService and CacheService.
    moduleRef = await Test.createTestingModule({ imports: [consumerModule] }).compile();

    expect(moduleRef.get(MetricsService, { strict: false })).toBeDefined();
  });
});
