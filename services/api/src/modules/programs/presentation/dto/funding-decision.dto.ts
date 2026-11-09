// services/api/src/modules/programs/presentation/dto/funding-decision.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsUUID, ValidateIf } from 'class-validator';

export const FUNDING_DECISIONS = ['awarded', 'not_awarded'] as const;
export type FundingDecisionValue = (typeof FUNDING_DECISIONS)[number];

// Bounds one request's updateMany (and the IN list) to something sane.
export const MAX_FUNDING_DECISION_BATCH = 1000;

export class SetFundingDecisionDto {
  @ApiProperty({ type: [String], description: `Application ids in this program (max ${MAX_FUNDING_DECISION_BATCH})` })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_FUNDING_DECISION_BATCH)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  applicationIds: string[];

  @ApiProperty({ enum: FUNDING_DECISIONS, nullable: true, description: 'null clears a recorded decision' })
  // Key is required, value may be null: ValidateIf skips only an explicit null,
  // so a missing key still fails IsIn.
  @ValidateIf((_, value) => value !== null)
  @IsIn(FUNDING_DECISIONS)
  decision: FundingDecisionValue | null;
}

export class SetFundingDecisionResponseDto {
  @ApiProperty({ description: 'Rows actually changed (ineligible ids are skipped silently)' })
  updated: number;
}
