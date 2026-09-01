// src/modules/programs/infrastructure/persistence/loa-batch-recipient-send.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { LoaBatchReleasedRecipient } from '../../../../common/types/events';

export const LOA_SEND_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export type LoaSendStatus = (typeof LOA_SEND_STATUS)[keyof typeof LOA_SEND_STATUS];

// error_message is TEXT, but an unbounded provider stack trace in an audit
// row helps nobody and bloats the read endpoint's payload.
export const MAX_SEND_ERROR_LENGTH = 500;

export function truncateSendError(error: string): string {
  return error.length > MAX_SEND_ERROR_LENGTH
    ? `${error.slice(0, MAX_SEND_ERROR_LENGTH - 1)}…`
    : error;
}

export interface RecordSendResultInput {
  batchId: string;
  participantId: string;
  providerMessageId: string | null;
  error: string | null;
}

@Injectable()
export class LoaBatchRecipientSendRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes one `pending` row per recipient at release time, before the
   * loa.batch.released event is published. Doing it up front — rather than
   * only when services/notification reports back — is what makes "who was
   * supposed to get this letter?" answerable even if the broker is down, the
   * notification service never starts, or the result event is lost.
   *
   * A re-release UPDATEs the existing row in place (resetting it to pending
   * for a fresh attempt) rather than appending a second one: the audit
   * question is "did this participant get their letter?", which one
   * current-state row per (batch, participant) answers directly, and the
   * unique constraint the table carries forbids appending anyway.
   * attemptCount, errorMessage and updatedAt keep the forensics that matter
   * without an append-only table nobody queries. In practice this path is
   * rarely re-entered at all: ReleaseLoaBatchHandler only notifies on a
   * genuine unreleased→released transition, so it takes an explicit
   * unrelease + re-release to get here twice.
   *
   * Uses createMany + skipDuplicates for the common first-release case (one
   * statement for the whole batch) and only falls back to per-row updates
   * for rows that already exist.
   */
  async markPending(
    batchId: string,
    programId: string,
    recipients: LoaBatchReleasedRecipient[],
  ): Promise<void> {
    if (recipients.length === 0) {
      return;
    }

    await this.prisma.loaBatchRecipientSend.createMany({
      data: recipients.map((recipient) => ({
        batchId,
        programId,
        participantId: recipient.participantId,
        userId: recipient.userId,
        email: recipient.email,
        status: LOA_SEND_STATUS.PENDING,
      })),
      skipDuplicates: true,
    });

    // Re-release path only: rows skipped above are carrying a stale outcome
    // from the previous release and must not keep reporting `sent` while a
    // fresh attempt is in flight.
    await this.prisma.loaBatchRecipientSend.updateMany({
      where: {
        batchId,
        participantId: { in: recipients.map((recipient) => recipient.participantId) },
        status: { not: LOA_SEND_STATUS.PENDING },
      },
      data: {
        status: LOA_SEND_STATUS.PENDING,
        providerMessageId: null,
        errorMessage: null,
        sentAt: null,
      },
    });
  }

  /**
   * Applies one reported outcome. `updateMany` (not `update`) so a result for
   * a participant with no pending row — a batch released before this table
   * existed, or a row deleted with its batch — is a silent no-op rather than
   * a thrown P2025 that would abort the rest of the batch's results.
   */
  async recordResult(input: RecordSendResultInput): Promise<void> {
    const succeeded = input.error === null;

    await this.prisma.loaBatchRecipientSend.updateMany({
      where: { batchId: input.batchId, participantId: input.participantId },
      data: {
        status: succeeded ? LOA_SEND_STATUS.SENT : LOA_SEND_STATUS.FAILED,
        providerMessageId: input.providerMessageId,
        errorMessage: succeeded ? null : truncateSendError(input.error ?? 'Unknown error'),
        sentAt: succeeded ? new Date() : null,
        attemptCount: { increment: 1 },
      },
    });
  }

  async findByBatch(batchId: string) {
    return this.prisma.loaBatchRecipientSend.findMany({
      where: { batchId },
      orderBy: [{ status: 'asc' }, { email: 'asc' }],
    });
  }
}
