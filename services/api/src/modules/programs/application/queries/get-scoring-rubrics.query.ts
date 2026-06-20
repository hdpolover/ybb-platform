import { ScoringStage } from '@prisma/client';

export class GetScoringRubricsQuery {
  constructor(
    public readonly programId: string,
    public readonly stage?: ScoringStage,
  ) {}
}
