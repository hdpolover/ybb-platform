// src/bootstrap/reporting-consumer.module.ts
import { Module } from '@nestjs/common';
import { ConsumerInfraModule } from './consumer-infra.module';
import { ReportingModule } from '@modules/reporting/reporting.module';

// Consumer container for `reporting_queue` (bound to ybb.events with routing key '#').
@Module({
  imports: [ConsumerInfraModule, ReportingModule],
})
export class ReportingConsumerModule {}
