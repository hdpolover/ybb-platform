// services/api/src/modules/applications/application/queries/get-application-review.query.ts
import { ScoringStage } from '@prisma/client';

export class GetApplicationReviewQuery {
  constructor(
    public readonly applicationId: string,
    public readonly stage: ScoringStage,
  ) {}
}
