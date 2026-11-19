import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CronLockService } from '../../shared/infrastructure/database/cron-lock.service';

/**
 * Service to clean up data change logs older than the retention period.
 *
 * Admin-authored rows (actorType 'admin') are the "who did what" trail and
 * are kept RETENTION_ADMIN_AUDIT_DAYS (default 365). Every other actor
 * (participant, system, webhook) keeps the 30-day window. 'admin' is the only
 * human-operator value in ChangedByType.
 */
@Injectable()
export class AuditCleanupService {
    private readonly logger = new Logger(AuditCleanupService.name);
    private readonly RETENTION_DAYS = 30;
    private readonly DEFAULT_ADMIN_RETENTION_DAYS = 365;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly cronLock: CronLockService,
    ) { }

    /**
     * Delete data change logs older than the retention period.
     * Runs daily at 3:00 AM.
     *
     * No claim guard of its own (a plain deleteMany), so this is wrapped like
     * every other cron here to keep N replicas from each running their own
     * deleteMany against the same window every day. The `{ deleted: 0 }`
     * default only surfaces when another replica already holds the lock -
     * cleanup() is not itself claiming/re-claiming anything, so "0 deleted,
     * did nothing this tick" is the correct and only meaning of a skip.
     */
    @Cron('0 3 * * *')
    async cleanup(): Promise<{ deleted: number }> {
        let outcome: { deleted: number } = { deleted: 0 };

        await this.cronLock.runExclusive('audit-cleanup', async () => {
            const adminDays = this.adminRetentionDays();
            const cutoffDate = this.daysAgo(this.RETENTION_DAYS);
            const adminCutoffDate = this.daysAgo(adminDays);

            this.logger.log(
                `Running audit cleanup — deleting non-admin logs older than ${cutoffDate.toISOString()} (${this.RETENTION_DAYS} days), ` +
                    `admin logs older than ${adminCutoffDate.toISOString()} (${adminDays} days)`,
            );

            try {
                const other = await this.prisma.dataChangeLog.deleteMany({
                    where: { actorType: { not: 'admin' }, createdAt: { lt: cutoffDate } },
                });
                const admin = await this.prisma.dataChangeLog.deleteMany({
                    where: { actorType: 'admin', createdAt: { lt: adminCutoffDate } },
                });

                this.logger.log(
                    `Audit cleanup complete — deleted ${other.count} non-admin and ${admin.count} admin log entries`,
                );
                outcome = { deleted: other.count + admin.count };
            } catch (error) {
                this.logger.error(`Audit cleanup failed: ${error.message}`, error.stack);
                throw error;
            }
        });

        return outcome;
    }

    private daysAgo(days: number): Date {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    }

    /** env values arrive as strings; a junk or non-positive value falls back rather than pruning everything. */
    private adminRetentionDays(): number {
        const days = Number(this.configService.get('RETENTION_ADMIN_AUDIT_DAYS', this.DEFAULT_ADMIN_RETENTION_DAYS));
        return Number.isFinite(days) && days > 0 ? days : this.DEFAULT_ADMIN_RETENTION_DAYS;
    }
}
