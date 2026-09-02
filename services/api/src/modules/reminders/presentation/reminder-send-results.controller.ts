// src/modules/reminders/presentation/reminder-send-results.controller.ts
import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { acknowledgeRmqMessage } from '@shared/infrastructure/rabbitmq/rmq-ack';
import { ParticipantReminderSendRepository } from '../infrastructure/persistence/participant-reminder-send.repository';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Consumes the per-recipient outcomes reported by services/notification after
 * it has attempted one dispatched reminder, and writes them onto the `pending`
 * rows the dispatch service created up front.
 *
 * This exists because services/notification has no database access of its own
 * (no Prisma or pg dependency) — the API stays the single writer to its own
 * schema. Direct mirror of LoaSendResultsController.
 */
@Controller()
export class ReminderSendResultsController {
  private readonly logger = new Logger(ReminderSendResultsController.name);

  constructor(private readonly sendRepo: ParticipantReminderSendRepository) {}

  @EventPattern('reminder.participant.send_result')
  async handleReminderSendResult(
    @Payload() payload: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    // Ack up front, like LoaSendResultsController: this is an audit write, so
    // redelivering it on failure would buy nothing (the emails have already
    // been sent) while risking a retry loop on a malformed payload.
    acknowledgeRmqMessage(
      context,
      this.logger,
      'reminder.participant.send_result',
      'received',
    );

    const data = asRecord(payload);
    const reminderId = getString(data, 'reminderId');
    const rawResults = Array.isArray(data.results) ? data.results : [];

    if (!reminderId || rawResults.length === 0) {
      this.logger.warn(
        `[participant-reminder] ignoring reminder.participant.send_result with reminderId=${reminderId ?? 'missing'} results=${rawResults.length}`,
      );
      return;
    }

    let recorded = 0;
    let failed = 0;

    // Sequential and individually guarded: one unwritable row must not cost the
    // audit trail for the rest of the reminder's results.
    for (const rawResult of rawResults) {
      const result = asRecord(rawResult);
      const participantId = getString(result, 'participantId');
      if (!participantId) continue;

      const error = getString(result, 'error') ?? null;

      try {
        await this.sendRepo.recordResult({
          reminderId,
          participantId,
          providerMessageId: getString(result, 'providerMessageId') ?? null,
          error,
        });
        recorded += 1;
        if (error) failed += 1;
      } catch (writeError) {
        this.logger.error(
          `[participant-reminder] failed to record send result reminder=${reminderId} participant=${participantId}`,
          writeError instanceof Error ? writeError.stack : String(writeError),
        );
      }
    }

    this.logger.log(
      `[participant-reminder] recorded ${recorded}/${rawResults.length} send results for reminder=${reminderId} (${failed} failed sends)`,
    );
  }
}
