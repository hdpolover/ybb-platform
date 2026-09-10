// src/bootstrap/consumer-infra.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { CacheCoreModule } from '@shared/infrastructure/cache/cache-core.module';
import { RabbitMQModule } from '@shared/infrastructure/rabbitmq/rabbitmq.module';
import { ExcelModule } from '@shared/infrastructure/excel/excel.module';
import { GeoIpModule } from '@shared/infrastructure/geoip/geoip.module';
import { validateEnv } from '../config/env.validation';

// Shared infrastructure for every RMQ consumer container. Each consumer app is a
// separate DI container, so the @Global infra modules (Prisma/Cache/RabbitMQ) must be
// re-imported here.
// NOTE: ScheduleModule is deliberately absent — cron jobs run only in the HTTP app to
// avoid double-firing (see PaymentReconciliationService).
// NOTE: ThrottlerModule is deliberately absent — it registers ThrottlerGuard as a global
// APP_GUARD which, in a standalone microservice app, runs on every RMQ event handler and
// throws "res.header is not a function" (no HTTP response to set rate-limit headers on),
// blocking event processing. Consumers have no HTTP surface, so they need no throttling.
// NOTE: CacheCoreModule, not the full CacheModule -- none of the five consumers that
// import ConsumerInfraModule need CacheWarmingService (re-runs the same DB-backed cache
// pre-population this app doesn't serve traffic for), RedisPubSubService (a second Redis
// connection pair + subscribe with nothing local to publish), or the @CacheInvalidate
// APP_INTERCEPTOR (keys off HTTP request params). The one consumer that does need
// cross-instance cache invalidation, payment-events, gets the full CacheModule through
// PaymentsModule directly (see bootstrap/payment-events-consumer.module.ts) -- unaffected
// by this file.
// NOTE: MetricsService (needed by PrismaService/CacheService for query/cache metrics)
// still reaches every consumer via PrismaModule -> MetricsCoreModule, which is @Global.
// The full MonitoringModule (QueueMonitoringService's own AMQP polling connection +
// MetricsMiddleware, which has no Express routes to attach to here) is deliberately not
// imported — it belongs to the HTTP app (src/app.module.ts).
@Module({
  imports: [
    // Audit M168: same validate as app.module.ts - every RMQ consumer app is
    // its own DI container/process (see the module-level comment above) and
    // must fail the same way at boot rather than each independently falling
    // back to an insecure default.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    PrismaModule,
    CacheCoreModule,
    RabbitMQModule,
    ExcelModule,
    GeoIpModule,
  ],
  exports: [ExcelModule, GeoIpModule],
})
export class ConsumerInfraModule {}
