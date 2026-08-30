// src/modules/programs/application/services/pricing-tier-coverage-alert.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { scanProgramsForPricingTierAlerts } from './scan-pricing-tier-alerts.util';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The push side of the pricing-tier-alerts detection that took China Youth
 * Summit's fully-funded category offline for nine days with no signal
 * anywhere: the banner and dashboard badge built on detectPricingTierAlerts
 * are both PULL - someone has to look. This runs unscoped (every published+
 * active program, not one caller's access scope) and emits an event when it
 * finds anything, so an outage doesn't depend on an admin opening the right
 * page.
 */
@Injectable()
export class PricingTierCoverageAlertService {
  private readonly logger = new Logger(PricingTierCoverageAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Runs once daily at 08:00 WIB - scheduled directly in Asia/Jakarta (rather
   * than a computed UTC cron expression) so the fire time is correct
   * regardless of the host container's TZ setting.
   *
   * HTTP-app-only: ProgramsModule (which provides this service) is only
   * imported by the root AppModule, never by any of the RMQ consumer bootstrap
   * modules (audit/reporting/payment-events - see src/bootstrap/*.ts), and
   * those consumer containers additionally never import ScheduleModule, so
   * @Cron is inert there even if that ever changes. Mirrors the precedent and
   * reasoning documented on SubmissionDeadlineReminderService.runScheduledReminders.
   */
  @Cron('0 8 * * *', { timeZone: 'Asia/Jakarta' })
  async runScheduledScan(): Promise<void> {
    try {
      await this.scanAndAlert();
    } catch (error) {
      this.logger.error(`[pricing-tier-coverage-alert] scheduled run failed: ${toErrorMessage(error)}`);
    }
  }

  async scanAndAlert(now: Date = new Date()): Promise<void> {
    const results = await scanProgramsForPricingTierAlerts(this.prisma, {}, now);

    const lapsedCount = results.reduce((n, r) => n + r.alerts.lapsed.length, 0);
    const expiringCount = results.reduce((n, r) => n + r.alerts.expiring.length, 0);

    // Always log the scan counts, even clean, so a dead cron (no line at all)
    // is distinguishable in the logs from a quiet one (a line with zeros).
    this.logger.log(
      `[pricing-tier-coverage-alert] scanned=${results.length} programsWithAlerts ` +
        `lapsedTiers=${lapsedCount} expiringTiers=${expiringCount}`,
    );

    if (results.length === 0) return;

    const recipients = this.resolveRecipients();
    if (recipients.length === 0) {
      // This is the exact failure mode that caused the nine-day outage:
      // detection fires, nobody is told. Never silently return here.
      this.logger.error(
        `[pricing-tier-coverage-alert] ${results.length} program(s) have pricing-tier coverage ` +
          `alerts (lapsedTiers=${lapsedCount} expiringTiers=${expiringCount}) but OPS_ALERT_EMAILS ` +
          `is missing or empty - no email can be delivered. Set OPS_ALERT_EMAILS to a comma-separated ` +
          `recipient list.`,
      );
      return;
    }

    await this.rabbitmqProducer.emit('ops.pricing_tier_coverage_alert', {
      recipients,
      programs: results.map((r) => ({
        programId: r.programId,
        programName: r.programName,
        brandName: r.brandName,
        tiers: [
          ...r.alerts.lapsed.map((t) => ({
            tierId: t.tierId,
            tierName: t.tierName,
            state: 'lapsed' as const,
            sinceDate: t.sinceDate.toISOString(),
            daysDark: Math.max(0, Math.round((now.getTime() - t.sinceDate.getTime()) / MS_PER_DAY)),
          })),
          ...r.alerts.expiring.map((t) => ({
            tierId: t.tierId,
            tierName: t.tierName,
            state: 'expiring' as const,
            coverageEndDate: t.coverageEndDate.toISOString(),
          })),
        ],
      })),
    });

    this.logger.log(
      `[pricing-tier-coverage-alert] emitted ops.pricing_tier_coverage_alert to ${recipients.length} ` +
        `recipient(s) for ${results.length} program(s)`,
    );
  }

  private resolveRecipients(): string[] {
    const raw = this.configService.get<string>('OPS_ALERT_EMAILS') ?? '';
    return raw
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
  }
}

function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.length > 1000 ? raw.slice(0, 1000) : raw;
}
