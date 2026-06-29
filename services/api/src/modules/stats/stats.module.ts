import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { ParticipantAnalyticsService } from './participant-analytics.service';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { CacheModule } from '../../shared/infrastructure/cache/cache.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, CacheModule, AuthModule],
  controllers: [StatsController],
  providers: [StatsService, ParticipantAnalyticsService],
  exports: [StatsService, ParticipantAnalyticsService],
})
export class StatsModule { }
