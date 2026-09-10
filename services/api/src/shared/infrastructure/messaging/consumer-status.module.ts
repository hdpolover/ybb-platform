// src/shared/infrastructure/messaging/consumer-status.module.ts
//
// ConsumerStatusService needs two independent writers — main.ts's RMQ
// bootstrap (connecting/connected/disconnected) and QueueMonitoringService's
// 15s consumer-count poll (per-queue liveness observations) — plus one
// reader, HealthController. QueueMonitoringService lives in MonitoringModule
// and HealthController in HealthModule; neither may import the other (that
// would either create a cycle the moment one of them needs something back,
// or quietly make HealthModule pull in QueueMonitoringService's AMQP
// connection + poll loop for every consumer of HealthModule). Nor is
// @Global appropriate — see prisma.module.ts's comment on what happened last
// time a module needed by every RMQ consumer container was made @Global
// (every consumer got its own copy of infrastructure it never needed).
//
// The fix is this: a small module that owns nothing but ConsumerStatusService,
// with no controllers, importable by both MonitoringModule and HealthModule
// without either depending on the other.
import { Module } from '@nestjs/common';
import { ConsumerStatusService } from './consumer-status.service';

@Module({
  providers: [ConsumerStatusService],
  exports: [ConsumerStatusService],
})
export class ConsumerStatusModule {}
