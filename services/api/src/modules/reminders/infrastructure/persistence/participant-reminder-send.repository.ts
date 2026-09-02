// src/modules/reminders/infrastructure/persistence/participant-reminder-send.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ParticipantReminderRecipient } from '../../../../common/types/events';
import {
  REMINDER_SEND_STATUS,
  truncateReminderSendError,
} from '../../reminder.constants';

export interface RecordReminderSendResultInput {
  reminderId: string;
  participantId: string;
  providerMessageId: string | null;
  error: string | null;
}

@Injectable()
export class ParticipantReminderSendRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes one `pending` row per recipient at dispatch time, BEFORE the
   * reminder.participant.dispatch event is published. Doing it up front — not
   * only once services/notification reports back — is what makes "who was
   * supposed to get this?" answerable even if the broker is down, the
   * notification service never starts, or the result event is lost.
   *
   * `skipDuplicates` against the (reminder_id, participant_id) unique index:
   * the status claim already guarantees this runs once per reminder, and this
   * is the belt to that braces. Unlike the LOA log there is no re-release path
   * to reset, so an existing row is left exactly as it is.
   */
  async markPending(
    reminderId: string,
    programId: string,
    recipients: ParticipantReminderRecipient[],
  ): Promise<void> {
    if (recipients.length === 0) {
      return;
    }

    await this.prisma.participantReminderSend.createMany({
      data: recipients.map((recipient) => ({
        reminderId,
        programId,
        participantId: recipient.participantId,
        userId: recipient.userId,
        email: recipient.email,
        status: REMINDER_SEND_STATUS.PENDING,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Applies one reported outcome. `updateMany` (not `update`) so a result for a
   * participant with no pending row — a lost pending write, or a row deleted
   * with its reminder — is a silent no-op rather than a thrown P2025 that would
   * abort the rest of the reminder's results.
   */
  async recordResult(input: RecordReminderSendResultInput): Promise<void> {
    const succeeded = input.error === null;

    await this.prisma.participantReminderSend.updateMany({
      where: { reminderId: input.reminderId, participantId: input.participantId },
      data: {
        status: succeeded ? REMINDER_SEND_STATUS.SENT : REMINDER_SEND_STATUS.FAILED,
        providerMessageId: input.providerMessageId,
        errorMessage: succeeded
          ? null
          : truncateReminderSendError(input.error ?? 'Unknown error'),
        sentAt: succeeded ? new Date() : null,
        attemptCount: { increment: 1 },
      },
    });
  }

  async findByReminder(reminderId: string) {
    return this.prisma.participantReminderSend.findMany({
      where: { reminderId },
      orderBy: [{ status: 'asc' }, { email: 'asc' }],
    });
  }

  /** Summary counts for a list of reminders, in one grouped query. */
  async summariseByReminderIds(reminderIds: string[]) {
    if (reminderIds.length === 0) return [];
    return this.prisma.participantReminderSend.groupBy({
      by: ['reminderId', 'status'],
      where: { reminderId: { in: reminderIds } },
      _count: { _all: true },
    });
  }
}
