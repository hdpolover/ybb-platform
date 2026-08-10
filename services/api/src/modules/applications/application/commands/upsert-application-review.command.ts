// services/api/src/modules/applications/application/commands/upsert-application-review.command.ts
import { ScoringStage } from '@prisma/client';
import { UserRole } from '@core/entities/user.entity';

export interface UpsertApplicationReviewItemDto {
  criterionId: string;
  score: number;
  notes?: string;
}

export interface UpsertApplicationReviewDto {
  status: 'draft' | 'submitted';
  notes?: string;
  items: UpsertApplicationReviewItemDto[];
  overrideReason?: string;
}

export class UpsertApplicationReviewCommand {
  constructor(
    public readonly applicationId: string,
    public readonly stage: ScoringStage,
    public readonly actingAdminId: string,
    public readonly actingAdminRole: UserRole,
    public readonly payload: UpsertApplicationReviewDto,
  ) {}
}
