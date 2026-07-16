// src/bootstrap/consumer-infra.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { CacheModule } from '@shared/infrastructure/cache/cache.module';
import { RabbitMQModule } from '@shared/infrastructure/rabbitmq/rabbitmq.module';
import { ExcelModule } from '@shared/infrastructure/excel/excel.module';
import { MonitoringModule } from '@shared/infrastructure/monitoring/monitoring.module';
import { GeoIpModule } from '@shared/infrastructure/geoip/geoip.module';

// Shared infrastructure for every RMQ consumer container. Each consumer app is a
// separate DI container, so the @Global infra modules (Prisma/Cache/RabbitMQ) must be
// re-imported here.
// NOTE: ScheduleModule is deliberately absent — cron jobs run only in the HTTP app to
// avoid double-firing (see PaymentReconciliationService).
// NOTE: ThrottlerModule is deliberately absent — it registers ThrottlerGuard as a global
// APP_GUARD which, in a standalone microservice app, runs on every RMQ event handler and
// throws "res.header is not a function" (no HTTP response to set rate-limit headers on),
// blocking event processing. Consumers have no HTTP surface, so they need no throttling.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    CacheModule,
    RabbitMQModule,
    ExcelModule,
    MonitoringModule,
    GeoIpModule,
  ],
  exports: [ExcelModule, MonitoringModule, GeoIpModule],
})
export class ConsumerInfraModule {}
