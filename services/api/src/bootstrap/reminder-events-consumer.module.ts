// src/bootstrap/reminder-events-consumer.module.ts
import { Module } from '@nestjs/common';
import { ConsumerInfraModule } from './consumer-infra.module';
import { ReminderSendResultsController } from '@modules/reminders/presentation/reminder-send-results.controller';
import { ParticipantReminderSendRepository } from '@modules/reminders/infrastructure/persistence/participant-reminder-send.repository';

// Consumer container for `api-service-reminder-events` (bound to ybb.events,
// routing key 'reminder.participant.send_result'). Deliberately imports only
// the repository the controller needs rather than the whole RemindersModule:
// RemindersModule carries the @Cron dispatcher, and registering that inside a
// consumer container would give the reminder scheduler a second home. Mirrors
// LoaEventsConsumerModule.
@Module({
  imports: [ConsumerInfraModule],
  controllers: [ReminderSendResultsController],
  providers: [ParticipantReminderSendRepository],
})
export class ReminderEventsConsumerModule {}
