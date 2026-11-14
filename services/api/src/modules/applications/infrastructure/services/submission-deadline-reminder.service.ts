// src/modules/applications/infrastructure/services/submission-deadline-reminder.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CronLockService } from '@shared/infrastructure/database/cron-lock.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { startOfWibDay, addDays } from '@shared/utils/wib-time';
import { resolveSubmissionCutoff } from '@shared/utils/submission-deadline.util';
import { buildParticipantSubmissionUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';

/**
 * Days before Program.applicationDeadline at which a participant with a
 * still-draft application gets reminded. applicationDeadline (NOT
 * registrationCloseDate) is the field that actually gates SUBMISSION -
 * registrationCloseDate only gates whether an application can be CREATED
 * (see submit-application.handler.ts / ApplicationEntity.canSubmit(), which
 * check nothing about registrationCloseDate at all). Misusing that field
 * previously locked ~130 participants out of application creation, so this
 * choice is deliberate, not a guess - see decisionsForHuman in the PR/task
 * notes for the human sign-off this warrants before going live.
 *
 * Ordered most urgent first: the offsets share one per-tick budget, and a
 * missed H-1 reminder cannot be made up the next day.
 */
const REMINDER_OFFSET_DAYS = [1, 3, 7] as const;
type ReminderOffsetDays = (typeof REMINDER_OFFSET_DAYS)[number];

/**
 * Reminders emitted per one-minute tick, across all offsets. These share
 * notification_queue with verification and password-reset emails, which the
 * notification service sends at up to ~10/s: one uncapped run for a large
 * program (23k drafts) would sit in front of those for the better part of an
 * hour. 150/min is a burst the consumer clears in well under a minute, and
 * leaves it mostly free for interactive mail.
 * ponytail: a fixed cap, blind to the real queue depth. If the consumer ever
 * runs slower than 2.5 mails/s the backlog still grows; read the queue depth
 * before emitting when that happens.
 */
const MAX_REMINDERS_PER_TICK = 150;

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

interface ReminderRunReport {
  scanned: number;
  sent: number;
  alreadySent: number;
  skippedNoEmail: number;
  errors: number;
}

const REMINDER_CANDIDATE_SELECT = {
  id: true,
  program: {
    select: {
      id: true,
      name: true,
      applicationDeadline: true,
      brandId: true,
      brand: { select: { landingUrl: true, websiteUrl: true } },
    },
  },
  participant: {
    select: {
      fullName: true,
      user: { select: { email: true } },
    },
  },
} satisfies Prisma.ParticipantApplicationSelect;

type ReminderCandidate = Prisma.ParticipantApplicationGetPayload<{
  select: typeof REMINDER_CANDIDATE_SELECT;
}>;

@Injectable()
export class SubmissionDeadlineReminderService {
  private readonly logger = new Logger(SubmissionDeadlineReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly cronLock: CronLockService,
  ) {}

  /**
   * Ticks every minute from 08:00 to 20:59 WIB, sending at most
   * MAX_REMINDERS_PER_TICK per tick - scheduled directly in Asia/Jakarta
   * (rather than a computed UTC cron expression) so the fire time is correct
   * regardless of the host container's TZ setting. Each tick only selects
   * applications with no claim yet (see findCandidates), so a run interrupted
   * by a redeploy picks up where it stopped. 13 hours of ticks cover 117k
   * reminders a day.
   *
   * HTTP-app-only: ApplicationsModule (which provides this service) is only
   * imported by the root AppModule, never by any of the RMQ consumer bootstrap
   * modules (audit/reporting/payment-events - see src/bootstrap/*.ts), and
   * those consumer containers additionally never import ScheduleModule, so
   * @Cron is inert there even if that ever changes. Mirrors the precedent and
   * reasoning documented on PaymentReconciliationService.runScheduledReconciliation.
   *
   * claimReminder() already guards each individual send with an updateMany,
   * so two replicas can't double-email the same participant - but without the
   * lock every replica would still separately scan the full due set every
   * tick. Kept for defence in depth (it also covers RabbitMQ redelivery,
   * unrelated to replica count) rather than removed now that the lock exists.
   */
  @Cron('* 8-20 * * *', { timeZone: 'Asia/Jakarta' })
  async runScheduledReminders(): Promise<void> {
    await this.cronLock.runExclusive('submission-deadline-reminder', async () => {
      try {
        const report = await this.sendDueReminders();
        // Most ticks find nothing due; only a tick that did work is worth a line.
        if (report.scanned === 0) return;
        this.logger.log(
          `[submission-reminder] scanned=${report.scanned} sent=${report.sent} ` +
            `alreadySent=${report.alreadySent} skippedNoEmail=${report.skippedNoEmail} errors=${report.errors}`,
        );
      } catch (error) {
        this.logger.error(`[submission-reminder] scheduled run failed: ${toErrorMessage(error)}`);
      }
    });
  }

  /**
   * Finds every DRAFT, non-deleted application whose program's
   * applicationDeadline falls on the WIB calendar day that is exactly
   * offsetDays from now, for each offset in REMINDER_OFFSET_DAYS, and emits an
   * application.submission_reminder event for each one not already sent.
   *
   * Matching by WIB calendar day (not a raw millisecond subtraction) means a
   * deadline of any time-of-day still reminds on the correct WIB date, and
   * every tick of the same WIB day resolves to the same set.
   *
   * The window's upper bound is computed via resolveSubmissionCutoff() - the
   * same shared resolver submit-application.handler.ts and
   * portal-submit-application.handler.ts use to reject late submissions - so
   * "the last day you can submit" and this reminder's "H-1" day are always in
   * lockstep and cannot silently drift apart.
   */
  async sendDueReminders(referenceDate: Date = new Date()): Promise<ReminderRunReport> {
    const report: ReminderRunReport = {
      scanned: 0,
      sent: 0,
      alreadySent: 0,
      skippedNoEmail: 0,
      errors: 0,
    };

    let budget = MAX_REMINDERS_PER_TICK;

    for (const offsetDays of REMINDER_OFFSET_DAYS) {
      if (budget <= 0) break;

      const targetInstant = addDays(referenceDate, offsetDays);
      const targetDayStart = startOfWibDay(targetInstant);
      // targetInstant is always a real Date, so resolveSubmissionCutoff never
      // returns null here - the non-null assertion is safe.
      const targetDayEnd = resolveSubmissionCutoff(targetInstant)!;

      const candidates = await this.findCandidates(
        offsetDays,
        { gte: targetDayStart, lt: targetDayEnd },
        budget,
      );

      budget -= candidates.length;
      report.scanned += candidates.length;

      for (const candidate of candidates) {
        try {
          const outcome = await this.remindOne(candidate, offsetDays);
          if (outcome === 'sent') report.sent += 1;
          else if (outcome === 'already_sent') report.alreadySent += 1;
          else report.skippedNoEmail += 1;
        } catch (error) {
          report.errors += 1;
          this.logger.error(
            `[submission-reminder] application=${candidate.id} offset=${offsetDays} failed: ${toErrorMessage(error)}`,
          );
        }
      }
    }

    return report;
  }

  /**
   * Up to `take` candidates for one offset that have no claim yet.
   *
   * SubmissionReminderLog has no Prisma relation to the application, so "not
   * yet claimed" is not expressible as a Prisma filter - hence the raw
   * anti-join. It is the ONLY place eligibility is decided: the second query
   * just loads the payload by id. A condition added to that second query alone
   * would leave rows that are selected here every tick but never claimed, and
   * they would fill the LIMIT and block everyone behind them.
   *
   * The email condition is what keeps remindOne's skipped_no_email branch from
   * being exactly such a row. The participant/user conditions mirror
   * ACTIVE_PARTICIPANT_WHERE (shared/utils/active-participant.filter.ts);
   * keep the two in step.
   */
  private async findCandidates(
    offsetDays: ReminderOffsetDays,
    deadlineWindow: { gte: Date; lt: Date },
    take: number,
  ): Promise<ReminderCandidate[]> {
    // No program due is the usual case: one read of a 30-row table per offset.
    const duePrograms = await this.prisma.program.findMany({
      where: { applicationDeadline: deadlineWindow },
      select: { id: true },
    });
    if (duePrograms.length === 0) return [];

    const programIds = duePrograms.map((program) => program.id);
    const unclaimed = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT pa.id
      FROM participant_applications pa
      JOIN participants pt ON pt.id = pa.participant_id
      JOIN users u ON u.id = pt.user_id
      WHERE pa.program_id = ANY(${programIds}::uuid[])
        AND pa.status = 'draft'
        AND pa.deleted_at IS NULL
        AND pt.deleted_at IS NULL
        AND u.is_active
        AND u.deleted_at IS NULL
        AND u.email <> ''
        AND NOT EXISTS (
          SELECT 1 FROM submission_reminder_logs l
          WHERE l.application_id = pa.id AND l.reminder_offset = ${offsetDays}
        )
      LIMIT ${take}
    `;
    if (unclaimed.length === 0) return [];

    return this.prisma.participantApplication.findMany({
      where: { id: { in: unclaimed.map((row) => row.id) } },
      select: REMINDER_CANDIDATE_SELECT,
    });
  }

  /**
   * Claim-then-send: the unique (application_id, reminder_offset) row is
   * inserted BEFORE the event is emitted, so the DB constraint is what
   * guarantees at-most-once delivery - not timing. A duplicate claim
   * (P2002) means this offset was already sent (by an earlier run, another
   * replica, or a retry) and is skipped. A claim that succeeds but whose
   * publish then fails is released again, so the next tick selects the
   * application once more; the failure still propagates and is counted as an
   * error. Without the release, every tick in which emit keeps throwing (for
   * example a producer that never initialised) would use up its claims for
   * nothing.
   */
  private async remindOne(
    candidate: ReminderCandidate,
    offsetDays: ReminderOffsetDays,
  ): Promise<'sent' | 'already_sent' | 'skipped_no_email'> {
    const email = candidate.participant?.user?.email;
    if (!email) {
      this.logger.warn(
        `[submission-reminder] skipping application ${candidate.id}: participant email not found`,
      );
      return 'skipped_no_email';
    }

    const claimed = await this.claimReminder(candidate.id, offsetDays);
    if (!claimed) {
      return 'already_sent';
    }

    const submissionPageUrl = buildParticipantSubmissionUrl(candidate.program.brand);

    try {
      await this.rabbitmqProducer.emit('application.submission_reminder', {
        email,
        customer_name: candidate.participant?.fullName ?? 'Participant',
        program: candidate.program.name,
        programId: candidate.program.id,
        brandId: candidate.program.brandId,
        deadline: candidate.program.applicationDeadline.toISOString(),
        daysRemaining: offsetDays,
        submissionPageUrl,
        metadata: {
          application_id: candidate.id,
          program_id: candidate.program.id,
          reminder_offset: offsetDays,
        },
      });
    } catch (error) {
      await this.prisma.submissionReminderLog.deleteMany({
        where: { applicationId: candidate.id, reminderOffset: offsetDays },
      });
      throw error;
    }

    // NOT yet picked up by AuditController (src/modules/audit/audit.controller.ts):
    // that consumer only persists an audit_log row for event names it explicitly
    // registers in AUDITED_EVENTS (see 'payment.reminder' there for the sibling
    // precedent), and 'application.submission_reminder' isn't in that list yet, so
    // audit_log_queue currently routes it to the unhandled-event catch-all instead
    // of an audit row. Until that's wired up, this structured line is the only way
    // to answer "did this participant get their reminder" without a raw SQL query
    // against submission_reminder_logs.
    this.logger.log(
      `[submission-reminder] sent application=${candidate.id} email=${email} ` +
        `program=${candidate.program.id} offset=${offsetDays} ` +
        `deadline=${candidate.program.applicationDeadline.toISOString()}`,
    );

    return 'sent';
  }

  /** Returns true if this call claimed the row (i.e. no reminder sent yet for this offset). */
  private async claimReminder(applicationId: string, offsetDays: ReminderOffsetDays): Promise<boolean> {
    try {
      await this.prisma.submissionReminderLog.create({
        data: { applicationId, reminderOffset: offsetDays },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        return false;
      }
      throw error;
    }
  }
}

function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.length > 1000 ? raw.slice(0, 1000) : raw;
}
