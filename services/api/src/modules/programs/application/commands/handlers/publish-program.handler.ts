// file: services/api/src/modules/programs/application/commands/handlers/publish-program.handler.ts
import { Inject, UnprocessableEntityException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { PublishProgramCommand } from '../publish-program.command';
import { GetProgramReadinessQuery } from '@modules/readiness/application/queries/get-program-readiness.query';
import { ReadinessReport } from '@modules/readiness/domain/readiness-rule.types';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';

@CommandHandler(PublishProgramCommand)
export class PublishProgramHandler implements ICommandHandler<PublishProgramCommand> {
  constructor(
    private readonly queryBus: QueryBus,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
  ) {}

  async execute(command: PublishProgramCommand): Promise<void> {
    const report: ReadinessReport = await this.queryBus.execute(
      new GetProgramReadinessQuery(command.programId),
    );

    // isReady is already false when a blocker fails OR a rule's status is
    // 'unknown' (evaluation threw, e.g. an external service is down). Both
    // cases are reported here as blockers so an unevaluable rule can never
    // be silently treated as publishable.
    if (!report.isReady) {
      const blocking = report.results.filter(
        (r) => r.severity === 'BLOCKER' && (r.status === 'fail' || r.status === 'unknown'),
      );
      throw new UnprocessableEntityException({
        message: 'This program is not ready to publish',
        blockers: blocking.map((r) => ({
          ruleId: r.ruleId,
          title: r.title,
          symptom: r.symptom,
          fix: r.fix,
          status: r.status,
        })),
      });
    }

    // All three flags, because active-program-resolver requires all three for a
    // program to be publicly visible. Setting isPublished alone yields a
    // program that reads as published in admin and is invisible to visitors.
    await this.programRepository.update(command.programId, {
      isPublished: true,
      isActive: true,
      status: 'published',
    });
  }
}
