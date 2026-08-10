import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
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
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Weight as a fraction 0-1.' })
  @IsNumber()
  @Min(0)
  weight!: number;

  @ApiProperty({ description: 'Maximum possible score; must be greater than 0.', default: 100 })
  @IsNumber()
  @Min(0.01)
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
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

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
