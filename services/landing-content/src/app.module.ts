import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { PublicController } from './public/public.controller';
import { PublicService } from './public/public.service';
import { DatabaseService } from './infrastructure/database.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, MetricsController, PublicController],
  providers: [DatabaseService, PublicService],
})
export class AppModule {}
