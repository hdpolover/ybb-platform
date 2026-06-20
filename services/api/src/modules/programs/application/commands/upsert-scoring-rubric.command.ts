import { ScoringStage } from '@prisma/client';
import { UpsertRubricPayload } from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

export class UpsertScoringRubricCommand {
  constructor(
    public readonly programId: string,
    public readonly stage: ScoringStage,
    public readonly payload: UpsertRubricPayload,
  ) {}
}
