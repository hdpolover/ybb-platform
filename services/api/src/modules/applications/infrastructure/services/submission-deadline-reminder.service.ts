// src/modules/applications/infrastructure/services/submission-deadline-reminder.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
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
 */
const REMINDER_OFFSET_DAYS = [7, 3, 1] as const;
type ReminderOffsetDays = (typeof REMINDER_OFFSET_DAYS)[number];

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
  ) {}

  /**
   * Runs once daily at 08:00 WIB - scheduled directly in Asia/Jakarta (rather
   * than a computed UTC cron expression) so the fire time is correct
   * regardless of the host container's TZ setting.
   *
   * HTTP-app-only: ApplicationsModule (which provides this service) is only
   * imported by the root AppModule, never by any of the RMQ consumer bootstrap
   * modules (audit/reporting/payment-events - see src/bootstrap/*.ts), and
   * those consumer containers additionally never import ScheduleModule, so
   * @Cron is inert there even if that ever changes. Mirrors the precedent and
   * reasoning documented on PaymentReconciliationService.runScheduledReconciliation.
   */
  @Cron('0 8 * * *', { timeZone: 'Asia/Jakarta' })
  async runScheduledReminders(): Promise<void> {
    try {
      const report = await this.sendDueReminders();
      this.logger.log(
        `[submission-reminder] scanned=${report.scanned} sent=${report.sent} ` +
          `alreadySent=${report.alreadySent} skippedNoEmail=${report.skippedNoEmail} errors=${report.errors}`,
      );
    } catch (error) {
      this.logger.error(`[submission-reminder] scheduled run failed: ${toErrorMessage(error)}`);
    }
  }

  /**
   * Finds every DRAFT, non-deleted application whose program's
   * applicationDeadline falls on the WIB calendar day that is exactly
   * offsetDays from now, for each offset in REMINDER_OFFSET_DAYS, and emits an
   * application.submission_reminder event for each one not already sent.
   *
   * Matching by WIB calendar day (not a raw millisecond subtraction) means a
   * deadline of any time-of-day still reminds on the correct WIB date, and the
   * cron only needs to fire once per WIB day to catch it.
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

    for (const offsetDays of REMINDER_OFFSET_DAYS) {
      const targetInstant = addDays(referenceDate, offsetDays);
      const targetDayStart = startOfWibDay(targetInstant);
      // targetInstant is always a real Date, so resolveSubmissionCutoff never
      // returns null here - the non-null assertion is safe.
      const targetDayEnd = resolveSubmissionCutoff(targetInstant)!;

      const candidates = await this.prisma.participantApplication.findMany({
        where: {
          status: ApplicationStatus.draft,
          deletedAt: null,
          program: {
            applicationDeadline: { gte: targetDayStart, lt: targetDayEnd },
          },
        },
        select: REMINDER_CANDIDATE_SELECT,
      });

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
