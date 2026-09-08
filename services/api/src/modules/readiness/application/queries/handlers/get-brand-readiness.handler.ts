// services/api/src/modules/readiness/application/queries/handlers/get-brand-readiness.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBrandReadinessQuery } from '../get-brand-readiness.query';
import { ReadinessContextLoader } from '../../../infrastructure/readiness-context.loader';
import { ReadinessRepository } from '../../../infrastructure/persistence/readiness.repository';
import { evaluateRules } from '../../../domain/evaluate-rules';
import { brandRulesFor } from '../../../domain/rules/brand.rules';
import { ReadinessReport } from '../../../domain/readiness-rule.types';

@QueryHandler(GetBrandReadinessQuery)
export class GetBrandReadinessHandler implements IQueryHandler<GetBrandReadinessQuery> {
  constructor(
    private readonly loader: ReadinessContextLoader,
    private readonly repository: ReadinessRepository,
  ) {}

  async execute(query: GetBrandReadinessQuery): Promise<ReadinessReport> {
    const [ctx, overrides] = await Promise.all([
      this.loader.loadBrand(query.brandId),
      this.repository.findActiveOverrides('brand', query.brandId),
    ]);
    const report = evaluateRules(brandRulesFor(query.brandId), ctx, overrides);
    await this.repository.saveSnapshot('brand', query.brandId, query.brandId, report, {
      subjectName: ctx.brand.name,
    });
    return report;
  }
}
