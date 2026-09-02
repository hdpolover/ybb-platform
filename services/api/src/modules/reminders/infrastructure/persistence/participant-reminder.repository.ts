// src/modules/reminders/infrastructure/persistence/participant-reminder.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  REMINDER_EDITABLE_STATUSES,
  REMINDER_STATUS,
  ReminderStatus,
} from '../../reminder.constants';

export interface CreateReminderData {
  programId: string;
  audience: string;
  subject: string;
  body: string;
  scheduledAt: Date | null;
  status: ReminderStatus;
  createdBy: string;
}

export interface UpdateReminderData {
  subject?: string;
  body?: string;
  scheduledAt?: Date | null;
  status?: ReminderStatus;
}

@Injectable()
export class ParticipantReminderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProgram(programId: string) {
    return this.prisma.participantReminder.findMany({
      where: { programId },
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string) {
    return this.prisma.participantReminder.findUnique({ where: { id } });
  }

  async create(data: CreateReminderData) {
    return this.prisma.participantReminder.create({ data });
  }

  /**
   * Guarded update: only a draft or still-scheduled reminder is editable, so a
   * PUT that races the dispatcher cannot rewrite the subject of a message
   * already going out. Returns null when nothing matched, which the caller
   * turns into a 409 rather than a silent no-op.
   */
  async updateIfEditable(id: string, data: UpdateReminderData) {
    const result = await this.prisma.participantReminder.updateMany({
      where: { id, status: { in: [...REMINDER_EDITABLE_STATUSES] } },
      data,
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  /**
   * Cancelling is the safety valve, so it is a single conditional UPDATE on
   * exactly the statuses that have not yet been claimed for sending. If the
   * dispatcher already flipped the row to `sending`, this matches nothing and
   * the caller reports "too late" instead of pretending the send was stopped.
   */
  async cancelIfNotSending(id: string) {
    const result = await this.prisma.participantReminder.updateMany({
      where: { id, status: { in: [...REMINDER_EDITABLE_STATUSES] } },
      data: { status: REMINDER_STATUS.CANCELLED, cancelledAt: new Date() },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  /** Ids of reminders whose send time has arrived. Ordered oldest-first. */
  async findDueIds(now: Date, limit: number): Promise<string[]> {
    const rows = await this.prisma.participantReminder.findMany({
      where: {
        status: REMINDER_STATUS.SCHEDULED,
        scheduledAt: { not: null, lte: now },
      },
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => row.id);
  }

  /**
   * THE idempotency primitive. A single `UPDATE ... WHERE id = $1 AND status =
   * 'scheduled'` is atomic in Postgres, so of any number of concurrent
   * dispatchers — a second scheduler tick, a second replica, a restart racing
   * itself — exactly one observes count === 1 and is allowed to fan out. Every
   * other caller gets null and does nothing. Mirrors LoaReleaseBatchRepository
   * .release()'s `transitioned` flag, which exists for the same reason.
   *
   * A row left in `sending` (process died mid-fan-out) is never re-claimed by
   * anything: this method only ever matches `scheduled`. That is the deliberate
   * choice of at-most-once over at-least-once — a stuck row is visible to an
   * admin and fixable; a double mail-out to a few thousand participants is not.
   */
  async claimForSending(id: string) {
    const result = await this.prisma.participantReminder.updateMany({
      where: { id, status: REMINDER_STATUS.SCHEDULED },
      data: { status: REMINDER_STATUS.SENDING, dispatchedAt: new Date() },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  /**
   * Closes the send. Guarded on `sending` so a cancel or a manual edit that
   * somehow landed in between cannot be overwritten back to `sent`.
   * `audienceCount` is recorded even when it is 0 — an empty audience is a real
   * outcome and must not read as "never dispatched".
   */
  async markSent(id: string, audienceCount: number) {
    await this.prisma.participantReminder.updateMany({
      where: { id, status: REMINDER_STATUS.SENDING },
      data: { status: REMINDER_STATUS.SENT, sentAt: new Date(), audienceCount },
    });
  }
}
