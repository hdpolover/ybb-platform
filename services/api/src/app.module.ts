import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { CacheModule } from '@shared/infrastructure/cache/cache.module';
import { ThrottlerModule } from '@shared/infrastructure/throttler/throttler.module';
import { CacheController } from '@shared/presentation/cache.controller';
import { MetricsController } from '@shared/presentation/metrics.controller';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { ProgramsModule } from '@modules/programs/programs.module';
import { ApplicationsModule } from '@modules/applications/applications.module';
import { HealthModule } from '@modules/health/health.module';
import { FilesModule } from '@modules/files/files.module';
import { ParticipantsModule } from '@modules/participants/participants.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { SystemModule } from '@modules/system/system.module';
import { BrandsModule } from '@modules/brands/brands.module';
import { SupportModule } from '@modules/support/support.module';
import { AchievementsModule } from '@modules/achievements/achievements.module';
import { LandingModule } from '@modules/landing/landing.module';

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

    // Feature modules
    AuthModule,
    UsersModule,
    ProgramsModule,
    ApplicationsModule,
    HealthModule,
    FilesModule,
    ParticipantsModule,
    PaymentsModule,
    SystemModule, // Added SystemModule to imports array
    BrandsModule,
    SupportModule,
    AchievementsModule,
    LandingModule,
  ],
  controllers: [CacheController, MetricsController],
})
export class AppModule { }
