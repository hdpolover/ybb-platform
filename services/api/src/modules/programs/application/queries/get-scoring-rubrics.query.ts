// services/api/src/modules/programs/application/queries/get-scoring-rubrics.query.ts
import { ScoringStage } from '@prisma/client';

/**
 * Get Scoring Rubrics Query
 *
 * Application Layer - Query
 */
export class GetScoringRubricsQuery {
  constructor(
    public readonly programId: string,
    public readonly stage?: ScoringStage,
    public readonly version?: number,
  ) {}
}
