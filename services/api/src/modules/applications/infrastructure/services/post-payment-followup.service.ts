// src/modules/applications/infrastructure/services/post-payment-followup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, PaymentStatus, PricingFeeType } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { startOfWibDay, addDays } from '@shared/utils/wib-time';
import { buildParticipantSubmissionUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';
import { ACTIVE_PARTICIPANT_WHERE } from '@shared/utils/active-participant.filter';

/**
 * Hard cutoff, set to the day this feature was deployed. Without it the first
 * run after deploy would match every participant who has EVER paid the
 * registration fee and is still unsubmitted — years of backlog, mailed all at
 * once. Only payments made after this instant are eligible for the nudge.
 */
export const POST_PAYMENT_FOLLOWUP_CUTOFF = new Date('2026-09-08T00:00:00+07:00');

/** Belt on the braces: one hourly tick cannot fan out an unbounded number of emails. */
const MAX_CANDIDATES_PER_TICK = 200;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const NINE_AM_OFFSET_MS = 9 * 60 * 60 * 1000;

interface FollowupRunReport {
  scanned: number;
  sent: number;
  notYetDue: number;
  notClaimed: number;
  errors: number;
}

const FOLLOWUP_CANDIDATE_SELECT = {
  id: true,
  program: {
    select: {
      name: true,
      brandId: true,
      contactEmail: true,
      contactAddress: true,
      brand: { include: { settings: true } },
    },
  },
  participant: {
    select: { fullName: true, user: { select: { email: true } } },
  },
  invoices: {
    where: {
      status: PaymentStatus.paid,
      paidAt: { not: null, gt: POST_PAYMENT_FOLLOWUP_CUTOFF },
      pricingTier: { feeType: PricingFeeType.registration_fee },
    },
    select: { paidAt: true },
    take: 1,
    orderBy: { paidAt: 'asc' },
  },
} satisfies Prisma.ParticipantApplicationSelect;

type FollowupCandidate = Prisma.ParticipantApplicationGetPayload<{
  select: typeof FOLLOWUP_CANDIDATE_SELECT;
}>;

/**
 * Sends a single one-shot email to a participant who paid the registration
 * fee but has not submitted their application, once the 3-day grace period
 * has passed. If they submit in the meantime they simply stop matching the
 * `submittedAt: null` filter below and are never claimed.
 *
 * HTTP-app-only: ApplicationsModule (which provides this service) is only
 * imported by the root AppModule, never by any RMQ consumer bootstrap module
 * (see src/bootstrap/*.ts), and those consumer containers don't import
 * ScheduleModule either — so @Cron is inert there even if that changes.
 * Mirrors the precedent on SubmissionDeadlineReminderService.
 */
@Injectable()
export class PostPaymentFollowupService {
  private readonly logger = new Logger(PostPaymentFollowupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledFollowups(): Promise<void> {
    try {
      const report = await this.sendDueFollowups();
      this.logger.log(
        `[post-payment-followup] scanned=${report.scanned} sent=${report.sent} ` +
          `notYetDue=${report.notYetDue} notClaimed=${report.notClaimed} errors=${report.errors}`,
      );
    } catch (error) {
      this.logger.error(`[post-payment-followup] scheduled run failed: ${toErrorMessage(error)}`);
    }
  }

  /**
   * Pre-filters in SQL on `paidAt <= now - 3 days` (a necessary but not
   * sufficient condition — see dueInstant below), then does the exact WIB
   * 09:00 send-window check per candidate in JS, since Prisma can't express
   * "next 9am after paidAt+3d" as a `where` predicate. Candidates that aren't
   * due yet are simply left alone — unclaimed, so the next hourly tick
   * re-evaluates them — never partially processed.
   */
  async sendDueFollowups(now: Date = new Date()): Promise<FollowupRunReport> {
    const report: FollowupRunReport = { scanned: 0, sent: 0, notYetDue: 0, notClaimed: 0, errors: 0 };
    const threeDaysAgo = new Date(now.getTime() - THREE_DAYS_MS);

    const candidates = await this.prisma.participantApplication.findMany({
      where: {
        submittedAt: null,
        deletedAt: null,
        postPaymentFollowupSentAt: null,
        participant: ACTIVE_PARTICIPANT_WHERE,
        invoices: {
          some: {
            status: PaymentStatus.paid,
            paidAt: { not: null, lte: threeDaysAgo, gt: POST_PAYMENT_FOLLOWUP_CUTOFF },
            pricingTier: { feeType: PricingFeeType.registration_fee },
          },
        },
      },
      select: FOLLOWUP_CANDIDATE_SELECT,
      // Oldest first, and deterministic. Without an explicit order Postgres may
      // return an unstable slice, so a backlog larger than the per-tick cap
      // could keep re-reading the same arbitrary rows while the oldest, most
      // overdue participants are never reached. Ordering guarantees the queue
      // drains from the front.
      orderBy: { createdAt: 'asc' },
      take: MAX_CANDIDATES_PER_TICK,
    });

    report.scanned = candidates.length;

    for (const candidate of candidates) {
      const paidAt = candidate.invoices[0]?.paidAt;
      if (!paidAt) continue; // filtered by the `some` above; defensive only.

      // Absolute instant, never a wall-clock offset: the next 09:00 WIB at or
      // after the 3-day mark, not "72 hours after the payment instant".
      if (now.getTime() < nextWib9amAtOrAfter(new Date(paidAt.getTime() + THREE_DAYS_MS)).getTime()) {
        report.notYetDue += 1;
        continue;
      }

      try {
        const outcome = await this.followUpOne(candidate);
        if (outcome === 'sent') report.sent += 1;
        else report.notClaimed += 1;
      } catch (error) {
        report.errors += 1;
        this.logger.error(
          `[post-payment-followup] application=${candidate.id} failed: ${toErrorMessage(error)}`,
        );
      }
    }

    return report;
  }

  /**
   * Claim-then-send: the conditional UPDATE (guarded on
   * `postPaymentFollowupSentAt IS NULL`) commits BEFORE the event is
   * emitted, so a crash mid-run loses at most one email — never repeats
   * thousands the way claiming after send would. A crash between claim and
   * emit is an accepted, permanent miss (mirrors remindOne()'s
   * publish-failure precedent) — at-most-once beats at-least-once here.
   */
  private async followUpOne(candidate: FollowupCandidate): Promise<'sent' | 'not_claimed'> {
    const email = candidate.participant?.user?.email;
    if (!email) {
      this.logger.warn(`[post-payment-followup] skipping application ${candidate.id}: no email on file`);
      return 'not_claimed';
    }

    const claimed = await this.prisma.participantApplication.updateMany({
      where: { id: candidate.id, postPaymentFollowupSentAt: null },
      data: { postPaymentFollowupSentAt: new Date() },
    });
    if (claimed.count === 0) {
      // Another tick (or a submit landing in the same instant) already
      // claimed or disqualified this row.
      return 'not_claimed';
    }

    const rawBrand = candidate.program?.brand ?? null;
    const brandPayload = rawBrand
      ? {
          name: rawBrand.name,
          primaryColor: rawBrand.primaryColor,
          logoUrl: rawBrand.logoUrl,
          websiteUrl: rawBrand.websiteUrl,
          contactEmail: candidate.program?.contactEmail ?? null,
          contactAddress: candidate.program?.contactAddress ?? null,
          socialMediaLinks: rawBrand.socialMediaLinks,
          settings: rawBrand.settings
            ? {
                footerNavigation: rawBrand.settings.footerNavigation,
                supportEmail: rawBrand.settings.supportEmail,
              }
            : null,
        }
      : null;

    await this.rabbitmqProducer.emit('notification.submission_nudge', {
      email,
      customer_name: candidate.participant?.fullName ?? 'Participant',
      program_name: candidate.program?.name ?? '',
      application_id: candidate.id,
      submission_url: buildParticipantSubmissionUrl(rawBrand),
      brand: brandPayload,
    });

    this.logger.log(`[post-payment-followup] sent application=${candidate.id} email=${email}`);

    return 'sent';
  }
}

/** The next 09:00 WIB instant that is >= `threshold`. */
function nextWib9amAtOrAfter(threshold: Date): Date {
  const sameDay9am = new Date(startOfWibDay(threshold).getTime() + NINE_AM_OFFSET_MS);
  if (sameDay9am.getTime() >= threshold.getTime()) return sameDay9am;
  return new Date(startOfWibDay(addDays(threshold, 1)).getTime() + NINE_AM_OFFSET_MS);
}

function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.length > 1000 ? raw.slice(0, 1000) : raw;
}
