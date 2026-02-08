import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { CacheModule } from '../../shared/infrastructure/cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule { }
