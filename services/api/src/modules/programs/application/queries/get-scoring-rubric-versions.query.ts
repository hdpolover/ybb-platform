// services/api/src/modules/programs/application/queries/get-scoring-rubric-versions.query.ts
import { ScoringStage } from '@prisma/client';

export class GetScoringRubricVersionsQuery {
  constructor(
    public readonly programId: string,
    public readonly stage: ScoringStage,
  ) {}
}
