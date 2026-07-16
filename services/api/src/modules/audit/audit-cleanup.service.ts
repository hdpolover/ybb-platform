import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

/**
 * Service to clean up data change logs older than the retention period.
 * 
 * Default retention: 30 days.
 */
@Injectable()
export class AuditCleanupService {
    private readonly logger = new Logger(AuditCleanupService.name);
    private readonly RETENTION_DAYS = 30;

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Delete data change logs older than the retention period.
     * Runs daily at 3:00 AM.
     */
    @Cron('0 3 * * *')
    async cleanup(): Promise<{ deleted: number }> {
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
            return { deleted: result.count };
        } catch (error) {
            this.logger.error(`Audit cleanup failed: ${error.message}`, error.stack);
            throw error;
        }
    }
}
