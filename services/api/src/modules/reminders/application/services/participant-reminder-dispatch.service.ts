// src/modules/reminders/application/services/participant-reminder-dispatch.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { buildParticipantPaymentsUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';
import { ParticipantReminderDispatchPayload } from '../../../../common/types/events';
import { ParticipantReminderRepository } from '../../infrastructure/persistence/participant-reminder.repository';
import { ParticipantReminderSendRepository } from '../../infrastructure/persistence/participant-reminder-send.repository';
import { RegistrationFeeAudienceService } from './registration-fee-audience.service';
import { REMINDER_AUDIENCES } from '../../reminder.constants';

/** Belt on the braces: no single tick can fan out an unbounded number of reminders. */
const MAX_REMINDERS_PER_TICK = 20;

export interface ReminderDispatchOutcome {
  reminderId: string;
  result: 'sent' | 'empty_audience' | 'not_claimed';
  recipientCount: number;
}

/**
 * Sends participant reminders that an admin scheduled.
 *
 * ── Idempotency ─────────────────────────────────────────────────────────────
 * Everything below hangs off one atomic claim:
 *
 *     UPDATE participant_reminders
 *        SET status = 'sending', dispatched_at = now()
 *      WHERE id = $1 AND status = 'scheduled'
 *
 * A single UPDATE with a status predicate is atomic in Postgres, so of any
 * number of concurrent dispatchers — an overlapping tick, a second replica, a
 * restart racing itself — exactly one sees a row count of 1 and is allowed to
 * publish. Every other caller sees 0 and returns immediately. The audience
 * snapshot, the pending rows and the publish all happen strictly AFTER the
 * claim has been won.
 *
 * A process that dies mid-fan-out leaves the row in `sending`, and nothing ever
 * re-claims it: findDueIds only selects `scheduled`. That is a deliberate
 * choice of at-most-once over at-least-once. A stuck `sending` row is visible
 * on the admin screen and can be reasoned about; a duplicate blast to a few
 * thousand participants cannot be taken back. There is a second, independent
 * guard behind that anyway: the (reminder_id, participant_id) unique index, and
 * services/notification's own payload-level dedupe in
 * NotificationIdempotencyService.
 *
 * ── Scheduling semantics ────────────────────────────────────────────────────
 * scheduled_at is an absolute instant (the API rejects offset-less input, so
 * the WIB wall clock an admin picked is the instant that got stored). The tick
 * runs every minute and claims everything with scheduled_at <= now, so the
 * guarantee is "at or shortly after the chosen minute", never before it.
 *
 * HTTP-app-only: RemindersModule is imported only by the root AppModule, never
 * by the RMQ consumer bootstrap modules (see src/bootstrap/*.ts), and those
 * consumer containers do not import ScheduleModule either — so @Cron is inert
 * there even if that ever changes. Mirrors the precedent documented on
 * PaymentReconciliationService.runScheduledReconciliation.
 */
@Injectable()
export class ParticipantReminderDispatchService {
  private readonly logger = new Logger(ParticipantReminderDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminderRepo: ParticipantReminderRepository,
    private readonly sendRepo: ParticipantReminderSendRepository,
    private readonly audienceService: RegistrationFeeAudienceService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runScheduledDispatch(): Promise<void> {
    try {
      const outcomes = await this.dispatchDue();
      if (outcomes.length === 0) return;

      const sent = outcomes.filter((outcome) => outcome.result === 'sent').length;
      const empty = outcomes.filter((outcome) => outcome.result === 'empty_audience').length;
      const notClaimed = outcomes.filter((outcome) => outcome.result === 'not_claimed').length;
      this.logger.log(
        `[participant-reminder] due=${outcomes.length} sent=${sent} emptyAudience=${empty} notClaimed=${notClaimed}`,
      );
    } catch (error) {
      this.logger.error(
        `[participant-reminder] scheduled dispatch failed: ${toErrorMessage(error)}`,
      );
    }
  }

  async dispatchDue(now: Date = new Date()): Promise<ReminderDispatchOutcome[]> {
    const dueIds = await this.reminderRepo.findDueIds(now, MAX_REMINDERS_PER_TICK);
    const outcomes: ReminderDispatchOutcome[] = [];

    // Sequential and individually guarded: one reminder that blows up must not
    // cost every other reminder due in the same minute.
    for (const reminderId of dueIds) {
      try {
        outcomes.push(await this.dispatchOne(reminderId));
      } catch (error) {
        this.logger.error(
          `[participant-reminder] dispatch failed reminder=${reminderId}: ${toErrorMessage(error)}`,
        );
      }
    }

    return outcomes;
  }

  async dispatchOne(reminderId: string): Promise<ReminderDispatchOutcome> {
    const reminder = await this.reminderRepo.claimForSending(reminderId);
    if (!reminder) {
      // Cancelled a moment ago, or another dispatcher got there first. Both are
      // correct outcomes, not errors.
      return { reminderId, result: 'not_claimed', recipientCount: 0 };
    }

    const recipients = await this.audienceService.findRecipients(reminder.programId);

    if (recipients.length === 0) {
      // Everyone paid between scheduling and the send time, or the program has
      // no registration fee configured at all. Record it and send nothing —
      // an empty audience is a normal outcome, not a failure.
      await this.reminderRepo.markSent(reminder.id, 0);
      this.logger.log(
        `[participant-reminder] reminder=${reminder.id} program=${reminder.programId} ` +
          `dispatched with 0 recipients — nothing sent`,
      );
      return { reminderId, result: 'empty_audience', recipientCount: 0 };
    }

    // Record the intended recipients BEFORE publishing, so "who was supposed to
    // get this?" is answerable even if the publish below fails, the broker is
    // down, or services/notification never reports back. The outcomes are
    // filled in later by ReminderSendResultsController.
    await this.recordPendingSends(reminder.id, reminder.programId, recipients);

    const program = await this.prisma.program.findUnique({
      where: { id: reminder.programId },
      select: {
        name: true,
        brandId: true,
        brand: { select: { name: true, websiteUrl: true, landingUrl: true } },
      },
    });

    const payload: ParticipantReminderDispatchPayload = {
      reminderId: reminder.id,
      programId: reminder.programId,
      programName: program?.name ?? '',
      brandId: program?.brandId ?? null,
      audience: reminder.audience ?? REMINDER_AUDIENCES.REGISTRATION_FEE_UNPAID,
      // Sent as templates, substituted per recipient by services/notification.
      subject: reminder.subject,
      body: reminder.body,
      paymentsUrl: buildParticipantPaymentsUrl(program?.brand),
      recipients,
      brand: program?.brand
        ? { name: program.brand.name, websiteUrl: program.brand.websiteUrl }
        : null,
    };

    try {
      await this.rabbitmqProducer.emit('reminder.participant.dispatch', payload);
    } catch (error) {
      // The claim is already committed and the pending rows already written, so
      // a publish failure must not be retried by flipping the row back to
      // `scheduled` — that would risk a double send if the publish actually
      // landed. The reminder is closed out as sent-with-pending-rows, which is
      // exactly what "outcome unknown" looks like on the admin screen.
      this.logger.error(
        `[participant-reminder] failed to publish reminder.participant.dispatch for reminder=${reminder.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    await this.reminderRepo.markSent(reminder.id, recipients.length);

    this.logger.log(
      `[participant-reminder] reminder=${reminder.id} program=${reminder.programId} ` +
        `audience=${reminder.audience} recipients=${recipients.length} dispatched`,
    );

    return { reminderId, result: 'sent', recipientCount: recipients.length };
  }

  /**
   * Best-effort: the audit log exists to explain the send, so it must never be
   * what stops one. A failure here is logged and the dispatch continues — the
   * reminder still goes out, it just goes out unlogged, which is strictly no
   * worse than the manual CSV blast this replaces.
   */
  private async recordPendingSends(
    reminderId: string,
    programId: string,
    recipients: ParticipantReminderDispatchPayload['recipients'],
  ): Promise<void> {
    try {
      await this.sendRepo.markPending(reminderId, programId, recipients);
    } catch (error) {
      this.logger.error(
        `[participant-reminder] failed to record ${recipients.length} pending send rows for reminder=${reminderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.length > 1000 ? raw.slice(0, 1000) : raw;
}
