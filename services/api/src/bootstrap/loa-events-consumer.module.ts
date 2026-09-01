// src/bootstrap/loa-events-consumer.module.ts
import { Module } from '@nestjs/common';
import { ConsumerInfraModule } from './consumer-infra.module';
import { LoaSendResultsController } from '@modules/programs/presentation/loa-send-results.controller';
import { LoaBatchRecipientSendRepository } from '@modules/programs/infrastructure/persistence/loa-batch-recipient-send.repository';

// Consumer container for `api-service-loa-events` (bound to ybb.events,
// routing key 'loa.batch.send_result'). Deliberately imports only the
// repository the controller needs rather than the whole ProgramsModule:
// ProgramsModule pulls in CQRS, HTTP, Auth, Files and Portal, none of which a
// single audit write requires, and keeping the container thin means this
// consumer cannot accidentally register another module's @EventPattern
// handlers against its queue.
@Module({
  imports: [ConsumerInfraModule],
  controllers: [LoaSendResultsController],
  providers: [LoaBatchRecipientSendRepository],
})
export class LoaEventsConsumerModule {}
