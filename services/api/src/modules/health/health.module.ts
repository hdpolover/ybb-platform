import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthV2Controller } from './health.v2.controller';
import { ConsumerStatusService } from '@shared/infrastructure/messaging/consumer-status.service';

// ConsumerStatusService is provided (and exported) here rather than declared
// @Global like PrismaModule: main.ts's bootstrap() resolves it via
// app.get(ConsumerStatusService) from the HTTP app's container, and the HTTP
// app always has HealthModule in its graph (see app.module.ts), so there's
// no need to widen this beyond the module that actually owns the read side
// (HealthController) and the module graph that needs the write side (main.ts).
@Module({
  controllers: [HealthController, HealthV2Controller],
  providers: [ConsumerStatusService],
  exports: [ConsumerStatusService],
})
export class HealthModule {}
