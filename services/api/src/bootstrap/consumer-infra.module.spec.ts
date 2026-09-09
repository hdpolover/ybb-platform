// src/bootstrap/consumer-infra.module.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConsumerInfraModule } from './consumer-infra.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { CacheWarmingService } from '@shared/infrastructure/cache/cache-warming.service';
import { RedisPubSubService } from '@shared/infrastructure/redis/redis-pubsub.service';
import { QueueMonitoringService } from '@shared/infrastructure/monitoring/queue-monitoring.service';

describe('ConsumerInfraModule', () => {
  let moduleRef: TestingModule;

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('compiles and exposes shared infra (no live DB/Redis connection at compile time)', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConsumerInfraModule],
    }).compile();

    // .compile() runs constructors but not onModuleInit, so no real connections open.
    expect(moduleRef.get(PrismaService, { strict: false })).toBeDefined();
  });

  it('does NOT register ThrottlerGuard (APP_GUARD throws on RMQ event handlers)', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConsumerInfraModule],
    }).compile();

    // ThrottlerGuard as a global APP_GUARD calls res.header() on a non-existent HTTP
    // response when run on an RMQ event handler, blocking event processing. Consumer
    // containers must never carry it.
    expect(() => moduleRef.get(ThrottlerGuard, { strict: false })).toThrow();
  });

  it('still exposes the metrics/cache surface every consumer needs (Prisma/Cache instrumentation)', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConsumerInfraModule],
    }).compile();

    // MetricsService reaches this container via PrismaModule -> MetricsCoreModule
    // (both @Global), even though ConsumerInfraModule no longer imports the full
    // MonitoringModule directly.
    expect(moduleRef.get(MetricsService, { strict: false })).toBeDefined();
    // CacheService comes from CacheCoreModule (@Global), swapped in for CacheModule.
    expect(moduleRef.get(CacheService, { strict: false })).toBeDefined();
  });

  it('does NOT carry the HTTP-app-only monitoring/cache extras (M219 fix)', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConsumerInfraModule],
    }).compile();

    // Regression guard for M219: these four used to be pulled into every RMQ
    // consumer container as a side effect of importing the full CacheModule and
    // MonitoringModule. None of the four "thin" consumers that build on
    // ConsumerInfraModule alone (audit, reporting, loa-events, reminder-events)
    // have any use for them:
    // - CacheWarmingService re-runs DB-backed cache pre-population this process
    //   serves no traffic for.
    // - RedisPubSubService opens a second Redis connection pair and subscribes
    //   to a channel nothing here publishes to.
    // - QueueMonitoringService opens its own AMQP connection and polls queue
    //   depth into a prom-client registry this process never exposes.
    expect(() => moduleRef.get(CacheWarmingService, { strict: false })).toThrow();
    expect(() => moduleRef.get(RedisPubSubService, { strict: false })).toThrow();
    expect(() => moduleRef.get(QueueMonitoringService, { strict: false })).toThrow();
  });
});
