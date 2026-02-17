import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { CacheModule } from '@shared/infrastructure/cache/cache.module';
import { ThrottlerModule } from '@shared/infrastructure/throttler/throttler.module';
import { RabbitMQModule } from '@shared/infrastructure/rabbitmq/rabbitmq.module';
import { ExcelModule } from '@shared/infrastructure/excel/excel.module';
import { MonitoringModule } from '@shared/infrastructure/monitoring/monitoring.module';
import { GeoIpModule } from '@shared/infrastructure/geoip/geoip.module';
import { CacheController } from '@shared/presentation/cache.controller';
import { MetricsController } from '@shared/presentation/metrics.controller';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
const LokiTransport = require('winston-loki');
import { trace, context } from '@opentelemetry/api';
import { AchievementsModule } from '@modules/achievements/achievements.module';
import { ApplicationsModule } from '@modules/applications/applications.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BrandsModule } from '@modules/brands/brands.module';
import { FilesModule } from '@modules/files/files.module';
import { HealthModule } from '@modules/health/health.module';
import { LandingModule } from '@modules/landing/landing.module';
import { LegalModule } from '@modules/legal/legal.module';
import { MetadataModule } from '@modules/metadata/metadata.module';
import { NewsletterModule } from '@modules/newsletter/newsletter.module';
import { AiBotModule } from '@modules/ai-bot/ai-bot.module';
import { ParticipantsModule } from '@modules/participants/participants.module';
import { PartnershipsModule } from '@modules/partnerships/partnerships.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { ProgramsModule } from '@modules/programs/programs.module';
import { StatsModule } from '@modules/stats/stats.module';
import { SupportModule } from '@modules/support/support.module';
import { SystemModule } from '@modules/system/system.module';
import { UsersModule } from '@modules/users/users.module';
import { GalleryModule } from '@modules/gallery/gallery.module';
import { PortalModule } from '@modules/portal/portal.module';
import { AuditModule } from '@modules/audit/audit.module';
import { ReportingModule } from '@modules/reporting/reporting.module';
import { AdminsModule } from '@modules/admins/admins.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Logging
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const transports: winston.transport[] = [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, context, ...meta }: any) => {
                return `${timestamp} [${context || 'Application'}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
              }),
            ),
          }),
        ];

        const lokiUrl = configService.get<string>('LOKI_URL') || 'http://loki:3100';
        const LokiTransportConstructor = (LokiTransport as any).default || LokiTransport;
        transports.push(
          new LokiTransportConstructor({
            host: lokiUrl,
            labels: { job: 'ybb-api' },
            json: true,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format((info: any) => {
                const span = trace.getSpan(context.active());
                if (span) {
                  const spanContext = span.spanContext();
                  info.traceId = spanContext.traceId;
                  info.spanId = spanContext.spanId;
                }
                return info;
              })(),
              winston.format.json(),
            ),
            replaceTimestamp: true,
            onConnectionError: (err) => console.error('Loki connection error:', err),
          }),
        );

        return {
          transports,
          // Set default level based on env
          level: configService.get('NODE_ENV') === 'production' ? 'info' : 'debug',
        };
      },
    }),

    // Infrastructure
    PrismaModule,
    ScheduleModule.forRoot(),
    CacheModule,
    ThrottlerModule,
    RabbitMQModule,
    ExcelModule,
    MonitoringModule,
    GeoIpModule,

    // Feature modules
    AchievementsModule,
    ApplicationsModule,
    AuthModule,
    BrandsModule,
    FilesModule,
    HealthModule,
    LandingModule,
    LegalModule,
    MetadataModule,
    NewsletterModule,
    AiBotModule,
    ParticipantsModule,
    PartnershipsModule,
    PaymentsModule,
    ProgramsModule,
    StatsModule,
    SupportModule,
    SystemModule,
    UsersModule,
    GalleryModule,
    PortalModule,
    AuditModule,
    ReportingModule,
    AdminsModule,
  ],
  controllers: [CacheController, MetricsController],
})
export class AppModule { }
