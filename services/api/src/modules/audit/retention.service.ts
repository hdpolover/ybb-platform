// src/modules/audit/retention.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

const BATCH_SIZE = 5000;
// Bounds one run to at most 20 x 5000 = 100k deletes per table, so a run with
// a large backlog can never hold the DB for long - it just picks up where it
// left off on tomorrow's run.
const MAX_BATCHES_PER_TABLE = 20;
const BATCH_PAUSE_MS = 200;

type PrunableModel = 'userSession' | 'userSecurityLog' | 'userActivityLog' | 'submissionReminderLog';

/**
 * Prunes log/session tables that otherwise grow unbounded:
 *  - user_sessions: expired (expires_at in the past)
 *  - user_security_logs, user_activity_logs: older than RETENTION_ACTIVITY_LOG_DAYS
 *  - submission_reminder_logs: older than RETENTION_REMINDER_LOG_DAYS
 *
 * data_change_logs is deliberately NOT handled here - AuditCleanupService
 * (same module) already prunes it daily on a 30-day retention window, which
 * is stricter than any window this service would apply, so a second cron
 * touching the same table would be dead code that never deletes anything.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Runs once daily at 03:30 WIB (off-peak) - scheduled directly in
   * Asia/Jakarta (rather than a computed UTC cron expression) so the fire
   * time is correct regardless of the host container's TZ setting. Mirrors
   * SubmissionDeadlineReminderService.
   *
   * HTTP-app-only: AuditModule (which provides this service) is only
   * imported by the root AppModule, never by any of the RMQ consumer
   * bootstrap modules (audit/reporting/payment-events/loa-events/reminder-
   * events - see src/bootstrap/*.ts), so this cron fires exactly once per
   * deploy. Mirrors the precedent documented on
   * PaymentReconciliationService.runScheduledReconciliation.
   */
  @Cron('30 3 * * *', { timeZone: 'Asia/Jakarta' })
  async runScheduledCleanup(): Promise<void> {
    const activityLogDays = this.configService.get<number>('RETENTION_ACTIVITY_LOG_DAYS', 180);
    const reminderLogDays = this.configService.get<number>('RETENTION_REMINDER_LOG_DAYS', 180);

    try {
      const deleted = await this.pruneBatched('userSession', { expiresAt: { lt: new Date() } });
      this.logger.log(`[retention] user_sessions deleted=${deleted}`);
    } catch (error) {
      this.logger.error(`[retention] user_sessions cleanup failed: ${toErrorMessage(error)}`);
    }

    try {
      const deleted = await this.pruneBatched('userSecurityLog', {
        createdAt: { lt: daysAgo(activityLogDays) },
      });
      this.logger.log(`[retention] user_security_logs deleted=${deleted} retentionDays=${activityLogDays}`);
    } catch (error) {
      this.logger.error(`[retention] user_security_logs cleanup failed: ${toErrorMessage(error)}`);
    }

    try {
      const deleted = await this.pruneBatched('userActivityLog', {
        createdAt: { lt: daysAgo(activityLogDays) },
      });
      this.logger.log(`[retention] user_activity_logs deleted=${deleted} retentionDays=${activityLogDays}`);
    } catch (error) {
      this.logger.error(`[retention] user_activity_logs cleanup failed: ${toErrorMessage(error)}`);
    }

    try {
      const deleted = await this.pruneBatched('submissionReminderLog', {
        sentAt: { lt: daysAgo(reminderLogDays) },
      });
      this.logger.log(`[retention] submission_reminder_logs deleted=${deleted} retentionDays=${reminderLogDays}`);
    } catch (error) {
      this.logger.error(`[retention] submission_reminder_logs cleanup failed: ${toErrorMessage(error)}`);
    }
  }

  /**
   * Deletes rows matching `where` in batches of BATCH_SIZE, id-scoped
   * (deleteMany has no `take`), pausing briefly between batches and stopping
   * after MAX_BATCHES_PER_TABLE so one run can't hold the DB for long.
   */
  private async pruneBatched(model: PrunableModel, where: Record<string, unknown>): Promise<number> {
    // Cast: the four delegates' findMany/deleteMany overloads differ only by
    // per-model `where` shape, which TS can't unify across a union - the
    // `where` we pass is already model-correct at each call site above.
    const delegate = this.prisma[model] as unknown as {
      findMany(args: { where: Record<string, unknown>; select: { id: true }; take: number }): Promise<{ id: string }[]>;
      deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
    };
    let deleted = 0;

    for (let batch = 0; batch < MAX_BATCHES_PER_TABLE; batch++) {
      const rows = await delegate.findMany({ where, select: { id: true }, take: BATCH_SIZE });
      if (rows.length === 0) break;

      const { count } = await delegate.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
      deleted += count;

      if (rows.length < BATCH_SIZE) break;
      await sleep(BATCH_PAUSE_MS);
    }

    return deleted;
  }
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
