import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthV2Controller } from './health.v2.controller';
import { ConsumerStatusModule } from '@shared/infrastructure/messaging/consumer-status.module';
import { AuthModule } from '@modules/auth/auth.module';

// ConsumerStatusService itself now lives in ConsumerStatusModule, not here --
// QueueMonitoringService (owned by MonitoringModule) needs to write to it too,
// and neither MonitoringModule nor HealthModule may import the other (see
// ConsumerStatusModule's comment). This module still re-exports it: main.ts's
// bootstrap() resolves it via app.get(ConsumerStatusService) from the HTTP
// app's container, and the HTTP app always has HealthModule in its graph (see
// app.module.ts).
//
// AuthModule is imported for the folded circuit-breaker/detailed endpoints'
// JwtAuthGuard + RolesGuard (see admin-programs.controller.ts for the same
// pattern) -- N-2026-09-10-D folded those out of the dead
// shared/presentation/health.controller.ts, which was never registered in any
// module and 404'd in production, onto this live controller instead of
// leaving them unreachable or exposing UnitOfWork's circuit-breaker internals
// on the public GET /health surface.
@Module({
  imports: [ConsumerStatusModule, AuthModule],
  controllers: [HealthController, HealthV2Controller],
  exports: [ConsumerStatusModule],
})
export class HealthModule {}
