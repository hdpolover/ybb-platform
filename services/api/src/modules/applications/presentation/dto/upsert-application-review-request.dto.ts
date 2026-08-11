// services/api/src/modules/applications/presentation/dto/upsert-application-review-request.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// NOTE: no actingAdminId, createdById, overrideById, totalScore, or
// scoreStatus fields here. Those are all derived server-side (the
// authenticated principal for attribution, the handler for scoring), never
// accepted from the client. main.ts's global ValidationPipe runs with
// { whitelist: true, forbidNonWhitelisted: true }, so declaring one of those
// fields here would let a forged value through; omitting them means the
// pipe rejects the request outright if a client tries to stuff one in.
export class UpsertApplicationReviewItemRequestDto {
  @ApiProperty()
  @IsString()
  criterionId!: string;

  @ApiProperty()
  @IsNumber()
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpsertApplicationReviewRequestDto {
  @ApiProperty({ enum: ['draft', 'submitted'] })
  @IsIn(['draft', 'submitted'])
  status!: 'draft' | 'submitted';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: () => UpsertApplicationReviewItemRequestDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertApplicationReviewItemRequestDto)
  items!: UpsertApplicationReviewItemRequestDto[];

  @ApiPropertyOptional({ description: 'Required when a SUPER_ADMIN overrides a closed interview gate.' })
  @IsOptional()
  @IsString()
  overrideReason?: string;
}
