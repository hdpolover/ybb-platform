import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CronLockService } from '../../shared/infrastructure/database/cron-lock.service';

/**
 * Service to clean up data change logs older than the retention period.
 * 
 * Default retention: 30 days.
 */
@Injectable()
export class AuditCleanupService {
    private readonly logger = new Logger(AuditCleanupService.name);
    private readonly RETENTION_DAYS = 30;

    constructor(
        private readonly prisma: PrismaService,
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
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

            this.logger.log(
                `Running audit cleanup — deleting logs older than ${cutoffDate.toISOString()} (${this.RETENTION_DAYS} days)`,
            );

            try {
                const result = await this.prisma.dataChangeLog.deleteMany({
                    where: {
                        createdAt: { lt: cutoffDate },
                    },
                });

                this.logger.log(`Audit cleanup complete — deleted ${result.count} log entries`);
                outcome = { deleted: result.count };
            } catch (error) {
                this.logger.error(`Audit cleanup failed: ${error.message}`, error.stack);
                throw error;
            }
        });

        return outcome;
    }
}
