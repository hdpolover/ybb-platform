import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthV2Controller } from './health.v2.controller';

@Module({
  controllers: [HealthController, HealthV2Controller],
})
export class HealthModule {}
