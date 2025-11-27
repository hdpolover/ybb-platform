import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { CacheModule } from '@shared/infrastructure/cache/cache.module';
import { CacheController } from '@shared/presentation/cache.controller';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { ProgramsModule } from '@modules/programs/programs.module';
import { ApplicationsModule } from '@modules/applications/applications.module';
import { HealthModule } from '@modules/health/health.module';

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

    // Feature modules
    AuthModule,
    UsersModule,
    ProgramsModule,
    ApplicationsModule,
    HealthModule,
  ],
  controllers: [CacheController],
})
export class AppModule {}
