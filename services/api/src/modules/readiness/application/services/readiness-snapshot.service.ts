// services/api/src/modules/readiness/application/services/readiness-snapshot.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QueryBus } from '@nestjs/cqrs';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { ReadinessRepository } from '../../infrastructure/persistence/readiness.repository';
import { GetProgramReadinessQuery } from '../queries/get-program-readiness.query';
import { ReadinessReport, RuleResult } from '../../domain/readiness-rule.types';

const isBlocking = (r: Pick<RuleResult, 'severity' | 'status'>) =>
  r.severity === 'BLOCKER' && (r.status === 'fail' || r.status === 'unknown');

@Injectable()
export class ReadinessSnapshotService {
  private readonly logger = new Logger(ReadinessSnapshotService.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly repository: ReadinessRepository,
    private readonly producer: RabbitMQProducerService,
    private readonly read: PrismaReadService,
  ) {}

  @Cron('0 6 * * *', { timeZone: 'Asia/Jakarta' })
  async reevaluatePublished(): Promise<void> {
    // All three flags: a program with isPublished true but isActive false is
    // not publicly visible, and alerting on it would be noise.
    const programs = await this.read.program.findMany({
      where: { isPublished: true, isActive: true, status: { not: 'draft' }, deletedAt: null },
      select: { id: true, name: true, brandId: true, brand: { select: { name: true } } },
    });

    const previous = await this.repository.findSnapshots();
    const previousBySubject = new Map(
      previous.map((row) => [`${row.subjectType}:${row.subjectId}`, row]),
    );

    for (const program of programs) {
      try {
        const report: ReadinessReport = await this.queryBus.execute(
          new GetProgramReadinessQuery(program.id),
        );

        const before = previousBySubject.get(`program:${program.id}`);
        const previousBlocking = new Set(
          ((before?.result as RuleResult[] | undefined) ?? [])
            .filter(isBlocking)
            .map((r) => r.ruleId),
        );

        // Report change, not state. A rule that was already failing is not news
        // and would train admins to ignore the digest.
        const newBlockers = report.results
          .filter(isBlocking)
          .filter((r) => !previousBlocking.has(r.ruleId));

        if (newBlockers.length > 0) {
          this.producer.emit('readiness.regression.detected', {
            subjectType: 'program',
            subjectId: program.id,
            programName: program.name,
            brandId: program.brandId,
            brandName: program.brand.name,
            newBlockers: newBlockers.map((r) => ({
              ruleId: r.ruleId,
              title: r.title,
              symptom: r.symptom,
            })),
          });
        }
      } catch (error) {
        // One unevaluable program must not abort the whole sweep.
        this.logger.error(
          `Readiness re-evaluation failed for program ${program.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
