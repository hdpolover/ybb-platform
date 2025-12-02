import { IsEnum, IsOptional, IsNumber, IsObject, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, ScoreStatus } from '@core/entities/participant-application.entity';

/**
 * Review Application Request DTO
 * 
 * Presentation Layer - API Request DTO
 */
export class ReviewApplicationRequestDto {
  @ApiProperty({ enum: ApplicationStatus, description: 'New status after review' })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

  @ApiPropertyOptional({ description: 'Reviewer notes' })
  @IsOptional()
  @IsString()
  reviewerNotes?: string;

  @ApiPropertyOptional({ description: 'Total score' })
  @IsOptional()
  @IsNumber()
  scoreTotal?: number;

  @ApiPropertyOptional({ description: 'Score breakdown by criteria' })
  @IsOptional()
  @IsObject()
  scoreBreakdown?: Record<string, number>;

  @ApiPropertyOptional({ enum: ScoreStatus, description: 'Score status' })
  @IsOptional()
  @IsEnum(ScoreStatus)
  scoreStatus?: ScoreStatus;
}
