import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { CacheModule } from '@shared/infrastructure/cache/cache.module';
import { ThrottlerModule } from '@shared/infrastructure/throttler/throttler.module';
import { RabbitMQModule } from '@shared/infrastructure/rabbitmq/rabbitmq.module';
import { CacheController } from '@shared/presentation/cache.controller';
import { MetricsController } from '@shared/presentation/metrics.controller';
import { AchievementsModule } from '@modules/achievements/achievements.module';
import { ApplicationsModule } from '@modules/applications/applications.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BrandsModule } from '@modules/brands/brands.module';
import { FilesModule } from '@modules/files/files.module';
import { HealthModule } from '@modules/health/health.module';
import { LandingModule } from '@modules/landing/landing.module';
import { ParticipantsModule } from '@modules/participants/participants.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { ProgramsModule } from '@modules/programs/programs.module';
import { StatsModule } from '@modules/stats/stats.module';
import { SupportModule } from '@modules/support/support.module';
import { SystemModule } from '@modules/system/system.module';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Infrastructure
    PrismaModule,
    CacheModule,
    ThrottlerModule,
    RabbitMQModule,

    // Feature modules
    AchievementsModule,
    ApplicationsModule,
    AuthModule,
    BrandsModule,
    FilesModule,
    HealthModule,
    LandingModule,
    ParticipantsModule,
    PaymentsModule,
    ProgramsModule,
    StatsModule,
    SupportModule,
    SystemModule,
    UsersModule,
  ],
  controllers: [CacheController, MetricsController],
})
export class AppModule { }
