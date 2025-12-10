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
  ],
  controllers: [CacheController, MetricsController],
})
export class AppModule { }

