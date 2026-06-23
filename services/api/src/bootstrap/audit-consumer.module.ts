// src/bootstrap/audit-consumer.module.ts
import { Module } from '@nestjs/common';
import { ConsumerInfraModule } from './consumer-infra.module';
import { AuditModule } from '@modules/audit/audit.module';

// Consumer container for `audit_log_queue` (bound to ybb.events with routing key '#').
// Only AuditController's handlers are discovered here, so each event is logged once.
@Module({
  imports: [ConsumerInfraModule, AuditModule],
})
export class AuditConsumerModule {}
