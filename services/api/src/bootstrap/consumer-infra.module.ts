// src/bootstrap/consumer-infra.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { CacheModule } from '@shared/infrastructure/cache/cache.module';
import { ThrottlerModule } from '@shared/infrastructure/throttler/throttler.module';
import { RabbitMQModule } from '@shared/infrastructure/rabbitmq/rabbitmq.module';
import { ExcelModule } from '@shared/infrastructure/excel/excel.module';
import { MonitoringModule } from '@shared/infrastructure/monitoring/monitoring.module';
import { GeoIpModule } from '@shared/infrastructure/geoip/geoip.module';

// Shared infrastructure for every RMQ consumer container. Each consumer app is a
// separate DI container, so the @Global infra modules (Prisma/Cache/RabbitMQ) must be
// re-imported here. NOTE: ScheduleModule is deliberately absent — cron jobs run only in
// the HTTP app to avoid double-firing (see PaymentReconciliationService).
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    CacheModule,
    ThrottlerModule,
    RabbitMQModule,
    ExcelModule,
    MonitoringModule,
    GeoIpModule,
  ],
  exports: [ExcelModule, MonitoringModule, GeoIpModule, ThrottlerModule],
})
export class ConsumerInfraModule {}
