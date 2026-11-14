// src/modules/applications/infrastructure/services/submission-deadline-reminder.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CronLockService } from '@shared/infrastructure/database/cron-lock.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { startOfWibDay, addDays } from '@shared/utils/wib-time';
import { resolveSubmissionCutoff } from '@shared/utils/submission-deadline.util';
import { buildParticipantSubmissionUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';
import { ACTIVE_PARTICIPANT_WHERE } from '@shared/utils/active-participant.filter';

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
 */
const REMINDER_OFFSET_DAYS = [7, 3, 1] as const;
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
   * regardless of the host container's TZ setting. Each tick resumes from the
   * claims already in submission_reminder_logs (see findCandidates), so a run
   * interrupted by a redeploy picks up where it stopped. 13 hours of ticks
   * cover 117k reminders a day.
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
   * deadline of any time-of-day still reminds on the correct WIB date, and the
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
        startOfWibDay(referenceDate),
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
   * The next `take` unclaimed candidates for one offset, in id order.
   *
   * SubmissionReminderLog has no Prisma relation to the application, so
   * "not yet claimed" cannot be a filter. Instead candidates are always walked
   * in id order and the highest application id claimed today for this offset
   * marks where the previous tick stopped. A candidate that failed before its
   * claim sits behind that mark and is not retried, same as a failed send
   * (see remindOne).
   */
  private async findCandidates(
    offsetDays: ReminderOffsetDays,
    deadlineWindow: { gte: Date; lt: Date },
    todayStart: Date,
    take: number,
  ): Promise<ReminderCandidate[]> {
    // Resolved to ids first, not joined: with literal program ids the planner
    // picks the program index for a small program and the id index for a large
    // one. Filtering through the deadline join made it walk the whole
    // applications table in id order. No program due is the usual case.
    const duePrograms = await this.prisma.program.findMany({
      where: { applicationDeadline: deadlineWindow },
      select: { id: true },
    });
    if (duePrograms.length === 0) return [];

    // ponytail: scans submission_reminder_logs, which has no index on
    // (reminder_offset, sent_at). Fine at ~100k rows; add the index past ~1M.
    const lastClaim = await this.prisma.submissionReminderLog.findFirst({
      where: { reminderOffset: offsetDays, sentAt: { gte: todayStart } },
      orderBy: { applicationId: 'desc' },
      select: { applicationId: true },
    });

    return this.prisma.participantApplication.findMany({
      where: {
        status: ApplicationStatus.draft,
        deletedAt: null,
        programId: { in: duePrograms.map((program) => program.id) },
        // Deactivated/deleted accounts don't get nudged to submit.
        participant: ACTIVE_PARTICIPANT_WHERE,
        ...(lastClaim ? { id: { gt: lastClaim.applicationId } } : {}),
      },
      select: REMINDER_CANDIDATE_SELECT,
      orderBy: { id: 'asc' },
      take,
    });
  }

  /**
   * Claim-then-send: the unique (application_id, reminder_offset) row is
   * inserted BEFORE the event is emitted, so the DB constraint is what
   * guarantees at-most-once delivery - not timing. A duplicate claim
   * (P2002) means this offset was already sent (by an earlier run, another
   * replica, or a retry) and is skipped. A claim that succeeds but whose
   * publish then fails is left to propagate to the caller (counted as an
   * error, logged, and NOT retried - matching the best-effort emitReminder()
   * precedent in PaymentReconciliationService). offsetDays is fixed, so there
   * is no later day on which this same offset would naturally recur to retry
   * against - a publish failure here means this one offset's reminder is
   * permanently missed for this application, by design.
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
