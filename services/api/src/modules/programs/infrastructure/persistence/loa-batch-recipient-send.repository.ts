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

export const LOA_DELIVERY_STATUS = {
  DELAYED: 'delayed',
  DELIVERED: 'delivered',
  BOUNCED: 'bounced',
  COMPLAINED: 'complained',
} as const;

export type LoaDeliveryStatus = (typeof LOA_DELIVERY_STATUS)[keyof typeof LOA_DELIVERY_STATUS];

// Higher wins. Bounce and complaint are terminal verdicts that must never be
// overwritten by a (possibly late or redelivered) delivered/delayed event; a
// complaint only ever follows a delivery, so it outranks a bounce.
const DELIVERY_RANK: Record<LoaDeliveryStatus, number> = {
  delayed: 0,
  delivered: 1,
  bounced: 2,
  complained: 3,
};

export interface DeliveryEvent {
  emailId: string;
  status: LoaDeliveryStatus;
  /** Resend's event created_at, not our receipt time. */
  occurredAt: Date;
  bounceType: string | null;
}

interface DeliveryState {
  deliveryStatus: string | null;
  deliveryUpdatedAt: Date | null;
}

/** Returns the column patch for this event, or null when it must be ignored. */
export function resolveDeliveryUpdate(current: DeliveryState, event: Omit<DeliveryEvent, 'emailId'>) {
  const currentRank = DELIVERY_RANK[current.deliveryStatus as LoaDeliveryStatus] ?? -1;
  const rank = DELIVERY_RANK[event.status];
  const isOlder =
    current.deliveryUpdatedAt !== null && event.occurredAt.getTime() <= current.deliveryUpdatedAt.getTime();
  if (rank < currentRank || (rank === currentRank && isOlder)) return null;

  return {
    deliveryStatus: event.status,
    deliveryUpdatedAt: event.occurredAt,
    ...(event.status === LOA_DELIVERY_STATUS.DELIVERED && { deliveredAt: event.occurredAt }),
    ...(event.status === LOA_DELIVERY_STATUS.BOUNCED && {
      bouncedAt: event.occurredAt,
      bounceType: event.bounceType,
    }),
    ...(event.status === LOA_DELIVERY_STATUS.COMPLAINED && { complainedAt: event.occurredAt }),
  };
}

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
        // A new message id is coming; the old message's delivery verdict is stale.
        deliveryStatus: null,
        deliveredAt: null,
        bouncedAt: null,
        bounceType: null,
        complainedAt: null,
        deliveryUpdatedAt: null,
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

  /**
   * Applies a Resend delivery webhook to the row(s) carrying that email id.
   * Returns how many rows matched (0 = not an LOA email; the caller still 200s).
   * The write is guarded on the state we just read, so two concurrent events
   * cannot both pass the rank check and clobber each other.
   */
  async applyDeliveryEvent(event: DeliveryEvent): Promise<number> {
    const rows = await this.prisma.loaBatchRecipientSend.findMany({
      where: { providerMessageId: event.emailId },
      select: { id: true, deliveryStatus: true, deliveryUpdatedAt: true },
    });

    for (const row of rows) {
      const patch = resolveDeliveryUpdate(row, event);
      if (!patch) continue;
      await this.prisma.loaBatchRecipientSend.updateMany({
        where: { id: row.id, deliveryStatus: row.deliveryStatus, deliveryUpdatedAt: row.deliveryUpdatedAt },
        data: patch,
      });
    }
    return rows.length;
  }

  async findByBatch(batchId: string) {
    return this.prisma.loaBatchRecipientSend.findMany({
      where: { batchId },
      orderBy: [{ status: 'asc' }, { email: 'asc' }],
    });
  }

  /**
   * Program-scoped email lookup for support: "did this person get the LOA
   * email?". `contains` + insensitive so a half-remembered address works;
   * unsent rows sort last since Postgres would otherwise put NULL sent_at first.
   */
  async searchByEmail(programId: string, email: string, limit: number) {
    return this.prisma.loaBatchRecipientSend.findMany({
      where: { programId, email: { contains: email, mode: 'insensitive' } },
      include: { batch: { select: { id: true, name: true } } },
      orderBy: [{ sentAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: limit,
    });
  }
}
