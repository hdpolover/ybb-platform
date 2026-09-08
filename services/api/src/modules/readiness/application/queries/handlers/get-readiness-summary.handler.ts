// services/api/src/modules/readiness/application/queries/handlers/get-readiness-summary.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetReadinessSummaryQuery } from '../get-readiness-summary.query';
import { ReadinessRepository } from '../../../infrastructure/persistence/readiness.repository';

export interface ReadinessSummaryRow {
  subjectType: string;
  subjectId: string;
  brandId: string;
  blockerCount: number;
  warningCount: number;
  evaluatedAt: Date;
}

@QueryHandler(GetReadinessSummaryQuery)
export class GetReadinessSummaryHandler implements IQueryHandler<GetReadinessSummaryQuery> {
  constructor(private readonly repository: ReadinessRepository) {}

  // Snapshot-backed on purpose: evaluating the whole fleet live on every page
  // load would be dozens of query bundles. evaluatedAt travels with each row so
  // the UI can say how stale a badge is instead of implying it is current.
  async execute(): Promise<ReadinessSummaryRow[]> {
    const rows = await this.repository.findSnapshots();
    return rows.map(({ result, ...rest }) => rest);
  }
}
