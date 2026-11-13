// src/modules/applications/infrastructure/services/funding-result-email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FundingDecision, Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CronLockService } from '@shared/infrastructure/database/cron-lock.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { buildParticipantDashboardUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';
import { ACTIVE_PARTICIPANT_WHERE } from '@shared/utils/active-participant.filter';
import { buildNotificationBrandBlock } from './notification-brand-block.util';

/**
 * Per hourly tick. The Resend transactional domain also carries payment
 * confirmations, so a program with thousands of decisions drains over several
 * ticks instead of one burst.
 */
const MAX_CANDIDATES_PER_TICK = 100;

interface FundingResultRunReport {
  scanned: number;
  sent: number;
  notClaimed: number;
  skipped: number;
  errors: number;
}

const CANDIDATE_SELECT = {
  id: true,
  fundingDecision: true,
  program: {
    select: {
      name: true,
      contactEmail: true,
      contactAddress: true,
      brand: { include: { settings: true } },
    },
  },
  participant: {
    select: { fullName: true, user: { select: { email: true } } },
  },
} satisfies Prisma.ParticipantApplicationSelect;

type Candidate = Prisma.ParticipantApplicationGetPayload<{ select: typeof CANDIDATE_SELECT }>;

/**
 * Emails a participant their Fully Funded selection result. Opt-in per program
 * (programs.funding_result_emails_enabled) because some programs already
 * emailed results by hand; nothing is sent before programs.funding_results_announced_at.
 * A decision recorded after the announcement date is emailed on the next tick.
 *
 * The result is the funding_decision column, never the application status.
 *
 * Kill switch: FUNDING_RESULT_EMAIL_ENABLED (default on), read per tick.
 *
 * DI: PrismaService + CronLockService come from the @Global PrismaModule,
 * RabbitMQProducerService from the @Global RabbitMQModule.
 *
 * HTTP-app-only: ApplicationsModule (which provides this service) is only
 * imported by the root AppModule, never by an RMQ consumer bootstrap module,
 * and those containers don't import ScheduleModule, so @Cron is inert there.
 * Mirrors DraftRegistrationNudgeService.
 */
@Injectable()
export class FundingResultEmailService {
  private readonly logger = new Logger(FundingResultEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly cronLock: CronLockService,
  ) {}

  // The per-candidate claim stops two replicas double-sending; the lock stops
  // every replica rescanning the candidate set each hour.
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledSends(): Promise<void> {
    if (!parseBool(process.env.FUNDING_RESULT_EMAIL_ENABLED, true)) return;

    await this.cronLock.runExclusive('funding-result-email', async () => {
      try {
        const report = await this.sendDueResults();
        this.logger.log(
          `[funding-result-email] scanned=${report.scanned} sent=${report.sent} skipped=${report.skipped} ` +
            `notClaimed=${report.notClaimed} errors=${report.errors}`,
        );
      } catch (error) {
        this.logger.error(`[funding-result-email] scheduled run failed: ${toErrorMessage(error)}`);
      }
    });
  }

  async sendDueResults(now: Date = new Date()): Promise<FundingResultRunReport> {
    const report: FundingResultRunReport = { scanned: 0, sent: 0, notClaimed: 0, skipped: 0, errors: 0 };

    const candidates = await this.prisma.participantApplication.findMany({
      where: buildCandidateWhere(now),
      select: CANDIDATE_SELECT,
      // Oldest decision first so a backlog drains from the front.
      orderBy: { fundingDecidedAt: 'asc' },
      take: MAX_CANDIDATES_PER_TICK,
    });
    report.scanned = candidates.length;

    for (const candidate of candidates) {
      try {
        const outcome = await this.sendOne(candidate);
        if (outcome === 'sent') report.sent += 1;
        else if (outcome === 'skipped') report.skipped += 1;
        else report.notClaimed += 1;
      } catch (error) {
        report.errors += 1;
        this.logger.error(
          `[funding-result-email] application=${candidate.id} failed: ${toErrorMessage(error)}`,
        );
      }
    }

    return report;
  }

  /**
   * Claim-then-send: the conditional UPDATE commits BEFORE the event is
   * emitted, so a crash loses at most one email and never repeats thousands.
   */
  private async sendOne(candidate: Candidate): Promise<'sent' | 'skipped' | 'not_claimed'> {
    const email = candidate.participant?.user?.email;
    const decision = candidate.fundingDecision;
    if (!email || !decision) {
      // Never log the address itself.
      this.logger.warn(`[funding-result-email] skipping application ${candidate.id}: no email or decision`);
      return 'skipped';
    }

    // Pinning the decision in the claim means a decision changed between the
    // read and now is left unclaimed and picked up (with the new value) next tick.
    const claimed = await this.prisma.participantApplication.updateMany({
      where: { id: candidate.id, fundingResultEmailSentAt: null, fundingDecision: decision },
      data: { fundingResultEmailSentAt: new Date() },
    });
    if (claimed.count === 0) return 'not_claimed';

    await this.rabbitmqProducer.emit(
      'notification.funding_result',
      buildPayload(candidate, email, decision),
      { messageId: `funding_result:${candidate.id}` },
    );

    this.logger.log(`[funding-result-email] sent application=${candidate.id} decision=${decision}`);
    return 'sent';
  }
}

export function buildCandidateWhere(now: Date): Prisma.ParticipantApplicationWhereInput {
  return {
    deletedAt: null,
    // With funding_result_email_sent_at IS NULL and deleted_at IS NULL, this is
    // the partial index predicate (idx_apps_funding_result_email_candidates).
    fundingDecision: { not: null },
    fundingResultEmailSentAt: null,
    participant: ACTIVE_PARTICIPANT_WHERE,
    program: {
      fundingResultEmailsEnabled: true,
      fundingResultsAnnouncedAt: { not: null, lte: now },
    },
  };
}

function buildPayload(candidate: Candidate, email: string, decision: FundingDecision) {
  const rawBrand = candidate.program?.brand ?? null;
  return {
    email,
    // full_name is '' until onboarding; the notification side falls back to "there".
    customer_name: candidate.participant?.fullName ?? '',
    program_name: candidate.program?.name ?? '',
    application_id: candidate.id,
    decision,
    portal_url: buildParticipantDashboardUrl(rawBrand),
    brand: buildNotificationBrandBlock(rawBrand, candidate.program),
  };
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.length > 1000 ? raw.slice(0, 1000) : raw;
}
