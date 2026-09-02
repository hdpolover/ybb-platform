// src/modules/reminders/reminders.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { RabbitMQModule } from '@shared/infrastructure/rabbitmq/rabbitmq.module';
import { ParticipantRemindersController } from './presentation/participant-reminders.controller';
import { ParticipantReminderService } from './application/services/participant-reminder.service';
import { ParticipantReminderDispatchService } from './application/services/participant-reminder-dispatch.service';
import { RegistrationFeeAudienceService } from './application/services/registration-fee-audience.service';
import { ParticipantReminderRepository } from './infrastructure/persistence/participant-reminder.repository';
import { ParticipantReminderSendRepository } from './infrastructure/persistence/participant-reminder-send.repository';

/**
 * Admin-drafted, admin-scheduled participant reminders.
 *
 * Plain injectable services rather than CQRS: this module is a scheduler plus
 * CRUD, and follows the shape of the other scheduled senders in the codebase
 * (SubmissionDeadlineReminderService, PaymentReconciliationService) rather than
 * the command/query handlers used for program content.
 *
 * Imported ONLY by the root AppModule. The RMQ consumer containers in
 * src/bootstrap/* deliberately do not import it, so the @Cron in
 * ParticipantReminderDispatchService registers exactly once, in the HTTP app.
 * The one piece this module contributes to a consumer container —
 * ReminderSendResultsController — is wired separately in
 * ReminderEventsConsumerModule with only the repository it needs.
 */
@Module({
  imports: [AuthModule, RabbitMQModule],
  controllers: [ParticipantRemindersController],
  providers: [
    ParticipantReminderService,
    ParticipantReminderDispatchService,
    RegistrationFeeAudienceService,
    ParticipantReminderRepository,
    ParticipantReminderSendRepository,
  ],
  exports: [RegistrationFeeAudienceService],
})
export class RemindersModule {}
