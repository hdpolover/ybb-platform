// src/modules/applications/infrastructure/services/draft-registration-nudge.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApplicationStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CronLockService } from '@shared/infrastructure/database/cron-lock.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { startOfWibDay, addDays } from '@shared/utils/wib-time';
import { isPastSubmissionDeadline } from '@shared/utils/submission-deadline.util';
import { buildParticipantSubmissionUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';
import { ACTIVE_PARTICIPANT_WHERE } from '@shared/utils/active-participant.filter';

/**
 * Forward-only: only applications created on/after this instant are ever
 * nudged. There is deliberately no backfill - ~27k older drafts exist and none
 * of them may be emailed. Do not move this earlier.
 */
export const DRAFT_NUDGE_CUTOFF = new Date('2026-11-14T00:00:00+07:00');

/**
 * Per query (nudge 1 and nudge 2 each), per hourly tick. The Resend transactional
 * domain also carries payment confirmations, so a burst to cold signups is the
 * risk to avoid: ~450 drafts/day drain over a handful of ticks instead of one.
 */
const MAX_CANDIDATES_PER_TICK = 100;

/** Nudge number -> days after application creation it becomes due. */
const NUDGE_DUE_DAYS = { 1: 2, 2: 7 } as const;
type NudgeNumber = keyof typeof NUDGE_DUE_DAYS;

/** Nudge 2 never goes out within a day of nudge 1 (e.g. after the kill switch was off). */
const MIN_NUDGE_GAP_DAYS = 1;

const NINE_AM_OFFSET_MS = 9 * 60 * 60 * 1000;

const NUDGE_SENT_AT_FIELD = {
  1: 'draftNudge1SentAt',
  2: 'draftNudge2SentAt',
} as const;

interface NudgeRunReport {
  scanned: number;
  sent: number;
  notClaimed: number;
  skipped: number;
  errors: number;
}

const NUDGE_CANDIDATE_SELECT = {
  id: true,
  program: {
    select: {
      name: true,
      brandId: true,
      applicationDeadline: true,
      contactEmail: true,
      contactAddress: true,
      brand: { include: { settings: true } },
    },
  },
  participant: {
    select: { fullName: true, user: { select: { email: true } } },
  },
} satisfies Prisma.ParticipantApplicationSelect;

type NudgeCandidate = Prisma.ParticipantApplicationGetPayload<{
  select: typeof NUDGE_CANDIDATE_SELECT;
}>;

/**
 * Two lifecycle emails (createdAt+2d, createdAt+7d, max 2 ever) to a verified
 * participant whose application is still a draft with no registration payment
 * started or made. Nudge 2 only follows a sent nudge 1.
 *
 * Sends only inside the WIB 09:00 window: a nudge is due at the first 09:00
 * WIB at or after createdAt + N days, and the SQL bound below is exactly that
 * set (see latestWib9amAtOrBefore). Program gate is evaluated at send time:
 * allow_registration is the master switch (beats dates) and
 * applicationDeadline, the same field SubmissionDeadlineReminderService and
 * the submit handlers use, must not have passed.
 *
 * Kill switch: DRAFT_NUDGE_ENABLED (default on), read per tick.
 *
 * HTTP-app-only: ApplicationsModule (which provides this service) is only
 * imported by the root AppModule, never by any RMQ consumer bootstrap module
 * (see src/bootstrap/*.ts), and those containers don't import ScheduleModule
 * either, so @Cron is inert there. Mirrors PostPaymentFollowupService.
 */
@Injectable()
export class DraftRegistrationNudgeService {
  private readonly logger = new Logger(DraftRegistrationNudgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly cronLock: CronLockService,
  ) {}

  // The per-candidate claim stops two replicas double-sending; the lock stops
  // every replica rescanning the candidate set each hour.
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledNudges(): Promise<void> {
    if (!parseBool(process.env.DRAFT_NUDGE_ENABLED, true)) return;

    await this.cronLock.runExclusive('draft-registration-nudge', async () => {
      try {
        const report = await this.sendDueNudges();
        this.logger.log(
          `[draft-nudge] scanned=${report.scanned} sent=${report.sent} skipped=${report.skipped} ` +
            `notClaimed=${report.notClaimed} errors=${report.errors}`,
        );
      } catch (error) {
        this.logger.error(`[draft-nudge] scheduled run failed: ${toErrorMessage(error)}`);
      }
    });
  }

  async sendDueNudges(now: Date = new Date()): Promise<NudgeRunReport> {
    const report: NudgeRunReport = { scanned: 0, sent: 0, notClaimed: 0, skipped: 0, errors: 0 };

    // Nudge 2 first: a row nudged for the first time this tick can then never
    // also be picked up for nudge 2 in the same tick.
    for (const nudge of [2, 1] as const) {
      const candidates = await this.findCandidates(nudge, now);
      report.scanned += candidates.length;

      for (const candidate of candidates) {
        try {
          const outcome = await this.nudgeOne(candidate, nudge, now);
          if (outcome === 'sent') report.sent += 1;
          else if (outcome === 'skipped') report.skipped += 1;
          else report.notClaimed += 1;
        } catch (error) {
          report.errors += 1;
          this.logger.error(
            `[draft-nudge] application=${candidate.id} nudge=${nudge} failed: ${toErrorMessage(error)}`,
          );
        }
      }
    }

    return report;
  }

  private findCandidates(nudge: NudgeNumber, now: Date): Promise<NudgeCandidate[]> {
    return this.prisma.participantApplication.findMany({
      where: buildCandidateWhere(nudge, now),
      select: NUDGE_CANDIDATE_SELECT,
      // Oldest first so a backlog drains from the front instead of re-reading
      // an arbitrary slice.
      orderBy: { createdAt: 'asc' },
      take: MAX_CANDIDATES_PER_TICK,
    });
  }

  /**
   * Claim-then-send: the conditional UPDATE commits BEFORE the event is
   * emitted, so a crash loses at most one email and never repeats thousands.
   * A crash between claim and emit is an accepted, permanent miss
   * (at-most-once beats at-least-once for a marketing-adjacent nudge).
   */
  private async nudgeOne(
    candidate: NudgeCandidate,
    nudge: NudgeNumber,
    now: Date,
  ): Promise<'sent' | 'skipped' | 'not_claimed'> {
    const email = candidate.participant?.user?.email;
    if (!email) {
      this.logger.warn(`[draft-nudge] skipping application ${candidate.id}: no email on file`);
      return 'skipped';
    }
    // The SQL bound already guarantees this; kept so the shared util stays the
    // single definition of "past the deadline".
    if (isPastSubmissionDeadline(candidate.program.applicationDeadline, now)) return 'skipped';

    const claimed = await this.prisma.participantApplication.updateMany({
      where: buildClaimWhere(candidate.id, nudge),
      data: { [NUDGE_SENT_AT_FIELD[nudge]]: new Date() },
    });
    if (claimed.count === 0) return 'not_claimed';

    await this.rabbitmqProducer.emit(
      'notification.draft_nudge',
      buildNudgePayload(candidate, email, nudge),
      { messageId: `draft_nudge:${candidate.id}:${nudge}` },
    );

    this.logger.log(`[draft-nudge] sent application=${candidate.id} nudge=${nudge} email=${email}`);
    return 'sent';
  }
}

export function buildCandidateWhere(
  nudge: NudgeNumber,
  now: Date,
): Prisma.ParticipantApplicationWhereInput {
  const dueDays = NUDGE_DUE_DAYS[nudge];
  // Due iff the first 09:00 WIB at/after createdAt+N is <= now, i.e. iff
  // createdAt+N <= the most recent 09:00 WIB. So no per-row window check.
  const createdBefore = addDays(latestWib9amAtOrBefore(now), -dueDays);

  return {
    status: ApplicationStatus.draft,
    deletedAt: null,
    legacyId: null,
    createdAt: { gte: DRAFT_NUDGE_CUTOFF, lte: createdBefore },
    // Also the index predicate (idx_apps_draft_nudge_candidates): the planner
    // can only use the partial index if the query implies it.
    draftNudge2SentAt: null,
    ...(nudge === 1
      ? { draftNudge1SentAt: null }
      : {
          draftNudge1SentAt: {
            not: null,
            lte: addDays(now, -MIN_NUDGE_GAP_DAYS),
          },
        }),
    participant: {
      ...ACTIVE_PARTICIPANT_WHERE,
      user: { ...ACTIVE_PARTICIPANT_WHERE.user, emailVerified: true },
    },
    // Nothing paid or in flight: unpaid / cancelled / failed invoices (or none)
    // are all fine. The application-level status is a belt for payments that
    // were recorded without an invoice row.
    registrationPaymentStatus: { notIn: [PaymentStatus.paid, PaymentStatus.processing] },
    invoices: { none: { status: { in: [PaymentStatus.paid, PaymentStatus.processing] } } },
    program: {
      allowRegistration: true,
      // isPastSubmissionDeadline(d) is false iff d >= start of today's WIB day.
      applicationDeadline: { gte: startOfWibDay(now) },
    },
  };
}

function buildClaimWhere(
  applicationId: string,
  nudge: NudgeNumber,
): Prisma.ParticipantApplicationWhereInput {
  return nudge === 1
    ? { id: applicationId, draftNudge1SentAt: null, draftNudge2SentAt: null }
    : { id: applicationId, draftNudge1SentAt: { not: null }, draftNudge2SentAt: null };
}

function buildNudgePayload(candidate: NudgeCandidate, email: string, nudge: NudgeNumber) {
  const rawBrand = candidate.program?.brand ?? null;
  const brand = rawBrand
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

  return {
    email,
    // full_name is '' until onboarding; the notification side falls back to "there".
    customer_name: candidate.participant?.fullName ?? '',
    program_name: candidate.program?.name ?? '',
    application_id: candidate.id,
    nudge_number: nudge,
    submission_url: buildParticipantSubmissionUrl(rawBrand),
    deadline: candidate.program?.applicationDeadline?.toISOString() ?? null,
    brand,
  };
}

/** The most recent 09:00 WIB instant that is <= `now`. */
function latestWib9amAtOrBefore(now: Date): Date {
  const sameDay9am = new Date(startOfWibDay(now).getTime() + NINE_AM_OFFSET_MS);
  if (sameDay9am.getTime() <= now.getTime()) return sameDay9am;
  return new Date(startOfWibDay(addDays(now, -1)).getTime() + NINE_AM_OFFSET_MS);
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.length > 1000 ? raw.slice(0, 1000) : raw;
}
