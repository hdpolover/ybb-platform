// services/api/src/modules/readiness/application/queries/handlers/get-program-readiness.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetProgramReadinessQuery } from '../get-program-readiness.query';
import { ReadinessContextLoader } from '../../../infrastructure/readiness-context.loader';
import { ReadinessRepository } from '../../../infrastructure/persistence/readiness.repository';
import { evaluateRules } from '../../../domain/evaluate-rules';
import { brandRulesFor } from '../../../domain/rules/brand.rules';
import { programRulesFor } from '../../../domain/rules/program.rules';
import { ReadinessReport } from '../../../domain/readiness-rule.types';

@QueryHandler(GetProgramReadinessQuery)
export class GetProgramReadinessHandler implements IQueryHandler<GetProgramReadinessQuery> {
  constructor(
    private readonly loader: ReadinessContextLoader,
    private readonly repository: ReadinessRepository,
  ) {}

  async execute(query: GetProgramReadinessQuery): Promise<ReadinessReport> {
    const ctx = await this.loader.loadProgram(query.programId);
    const brandId = ctx.brand.id;

    // A program cannot be ready if its brand is not: the public page renders
    // brand chrome, and its documents carry the brand signature.
    const [programOverrides, brandOverrides] = await Promise.all([
      this.repository.findActiveOverrides('program', query.programId),
      this.repository.findActiveOverrides('brand', brandId),
    ]);

    const report = evaluateRules(
      [...brandRulesFor(brandId), ...programRulesFor(query.programId)],
      ctx,
      [...programOverrides, ...brandOverrides],
    );
    await this.repository.saveSnapshot('program', query.programId, brandId, report, {
      subjectName: ctx.program?.name ?? query.programId,
      brandName: ctx.brand.name,
    });
    return report;
  }
}
