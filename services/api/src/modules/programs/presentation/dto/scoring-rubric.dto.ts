// services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Request DTOs

export class UpsertCriterionDto {
  @ApiPropertyOptional({ description: 'Existing criterion ID for update; omit to create.' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Criterion name.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255) // matches scoring_criteria.name @db.VarChar(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Weight as a fraction 0-1.' })
  @IsNumber()
  @Min(0)
  weight!: number;

  // Writes to scoring_criteria.max_score, a Decimal(5,2) column (max 999.99). An
  // unbounded value here reaches Postgres as a 22003 numeric_value_out_of_range,
  // which surfaces to the client as an opaque 500 -- this is the third time this
  // exact defect class (unguarded value into a length/precision-constrained
  // column) has bitten this codebase, so reject it here instead.
  @ApiProperty({ description: 'Maximum possible score; must be greater than 0.', default: 100 })
  @IsNumber()
  @Min(0.01)
  @Max(999.99)
  maxScore!: number;

  @ApiProperty({ description: 'Display order (zero-based integer).' })
  @IsInt()
  order!: number;
}

export class UpsertCategoryDto {
  @ApiPropertyOptional({ description: 'Existing category ID for update; omit to create.' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Category name.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100) // matches scoring_categories.name @db.VarChar(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Weight as a fraction 0-1.' })
  @IsNumber()
  @Min(0)
  weight!: number;

  @ApiProperty({ description: 'Display order (zero-based integer).' })
  @IsInt()
  order!: number;

  @ApiProperty({ type: () => UpsertCriterionDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCriterionDto)
  criteria!: UpsertCriterionDto[];
}

export class UpsertScoringRubricDto {
  @ApiPropertyOptional({ description: 'Human-readable rubric name.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255) // matches scoring_schemas.name @db.VarChar(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  // Writes to scoring_schemas.pass_threshold, a Decimal(5,2) column (max 999.99), but this
  // is a 0-100 SCORE cutoff by definition, so the real ceiling is 100, not the column's.
  @ApiPropertyOptional({ description: 'Pass/fail cutoff for this stage, 0-100.', default: 75 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passThreshold?: number;

  @ApiProperty({ type: () => UpsertCategoryDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCategoryDto)
  categories!: UpsertCategoryDto[];
}

// Response DTOs

export class RubricCriterionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  weight!: number;

  @ApiProperty()
  maxScore!: number;

  @ApiProperty()
  order!: number;
}

export class RubricCategoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  weight!: number;

  @ApiProperty()
  order!: number;

  @ApiProperty({ type: () => RubricCriterionDto, isArray: true })
  criteria!: RubricCriterionDto[];
}

export class RubricDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  programId!: string;

  @ApiProperty()
  stage!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  passThreshold!: number;

  @ApiProperty({ type: () => RubricCategoryDto, isArray: true })
  categories!: RubricCategoryDto[];
}

export class ScoringRubricsResponseDto {
  @ApiPropertyOptional({ type: () => RubricDto, nullable: true })
  application!: RubricDto | null;

  @ApiPropertyOptional({ type: () => RubricDto, nullable: true })
  interview!: RubricDto | null;
}

export class RubricVersionSummaryDto {
  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ nullable: true })
  createdByName!: string | null;

  @ApiProperty({ description: 'True if any submitted ApplicationReview is pinned to this version.' })
  hasSubmittedReviews!: boolean;
}
