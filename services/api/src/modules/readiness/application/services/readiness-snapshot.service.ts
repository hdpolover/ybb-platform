// services/api/src/modules/readiness/application/services/readiness-snapshot.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QueryBus } from '@nestjs/cqrs';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CronLockService } from '@shared/infrastructure/database/cron-lock.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { ReadinessRepository } from '../../infrastructure/persistence/readiness.repository';
import { GetProgramReadinessQuery } from '../queries/get-program-readiness.query';
import { GetBrandReadinessQuery } from '../queries/get-brand-readiness.query';
import { ReadinessReport, ReadinessScope, RuleResult } from '../../domain/readiness-rule.types';

const isBlocking = (r: Pick<RuleResult, 'severity' | 'status'>) =>
  r.severity === 'BLOCKER' && (r.status === 'fail' || r.status === 'unknown');

interface AlertEventBase {
  subjectType: ReadinessScope;
  subjectId: string;
  programName: string;
  brandId: string;
  brandName: string;
}

@Injectable()
export class ReadinessSnapshotService {
  private readonly logger = new Logger(ReadinessSnapshotService.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly repository: ReadinessRepository,
    private readonly producer: RabbitMQProducerService,
    private readonly read: PrismaReadService,
    private readonly cronLock: CronLockService,
  ) {}

  // No claim guard of its own - a plain scan-and-diff-against-baseline. Left
  // unwrapped, N replicas would each diff the same baseline and each emit its
  // own readiness-regressed alert event for one real regression.
  @Cron('0 6 * * *', { timeZone: 'Asia/Jakarta' })
  async reevaluatePublished(): Promise<void> {
    await this.cronLock.runExclusive('readiness-snapshot', async () => {
      await this.sweepPrograms();
      await this.sweepBrands();
    });
  }

  private async sweepPrograms(): Promise<void> {
    // All three flags: a program with isPublished true but isActive false is
    // not publicly visible, and alerting on it would be noise.
    const programs = await this.read.program.findMany({
      where: { isPublished: true, isActive: true, status: { not: 'draft' }, deletedAt: null },
      select: { id: true, name: true, brandId: true, brand: { select: { name: true } } },
    });

    for (const program of programs) {
      try {
        const report: ReadinessReport = await this.queryBus.execute(
          new GetProgramReadinessQuery(program.id),
        );
        await this.diffAgainstBaselineAndAlert('program', program.id, report, {
          subjectType: 'program',
          subjectId: program.id,
          programName: program.name,
          brandId: program.brandId,
          brandName: program.brand.name,
        });
      } catch (error) {
        // One unevaluable program must not abort the whole sweep.
        this.logger.error(
          `Readiness re-evaluation failed for program ${program.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  // The fleet board only shows a brand if someone opens its readiness panel
  // (GET writes the snapshot). A brand nobody happens to click into stayed
  // invisible on the board and never got swept for the nightly alert either.
  private async sweepBrands(): Promise<void> {
    const brands = await this.read.brand.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });

    for (const brand of brands) {
      try {
        const report: ReadinessReport = await this.queryBus.execute(
          new GetBrandReadinessQuery(brand.id),
        );
        await this.diffAgainstBaselineAndAlert('brand', brand.id, report, {
          subjectType: 'brand',
          subjectId: brand.id,
          programName: brand.name,
          brandId: brand.id,
          brandName: brand.name,
        });
      } catch (error) {
        this.logger.error(
          `Readiness re-evaluation failed for brand ${brand.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  // The alert job keeps its own baseline (readiness_alert_baselines),
  // written only here — never by get-brand-readiness/get-program-readiness,
  // which write readiness_snapshots on every GET to keep the fleet board
  // fresh. Diffing against readiness_snapshots instead let an admin merely
  // viewing a panel overwrite the "previous" state, so a real regression
  // that happened between sweeps looked already-known and nobody got
  // emailed. See readiness-snapshot.service.spec.ts.
  private async diffAgainstBaselineAndAlert(
    subjectType: ReadinessScope,
    subjectId: string,
    report: ReadinessReport,
    eventBase: AlertEventBase,
  ): Promise<void> {
    const previousBlocking = new Set(await this.repository.getAlertBaseline(subjectType, subjectId) ?? []);

    const blocking = report.results.filter(isBlocking);

    // Report change, not state. A rule that was already failing is not news
    // and would train admins to ignore the digest.
    const newBlockers = blocking.filter((r) => !previousBlocking.has(r.ruleId));

    if (newBlockers.length > 0) {
      // Fire-and-forget via emitSafe: an internal ops alert, not a
      // user-visible outcome — a broker hiccup should not fail (or block)
      // the readiness sweep that produced this diff.
      void this.producer.emitSafe('readiness.regression.detected', {
        ...eventBase,
        newBlockers: newBlockers.map((r) => ({
          ruleId: r.ruleId,
          title: r.title,
          symptom: r.symptom,
        })),
      });
    }

    await this.repository.saveAlertBaseline(subjectType, subjectId, blocking.map((r) => r.ruleId));
  }
}
