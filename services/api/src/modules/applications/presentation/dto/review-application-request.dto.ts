import { IsEnum, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@core/entities/participant-application.entity';

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

  @ApiPropertyOptional({
    enum: ['participant', 'ambassador'],
    description: 'Acceptance mode when the application is approved',
  })
  @IsOptional()
  @IsString()
  @IsIn(['participant', 'ambassador'])
  approvalMode?: 'participant' | 'ambassador';
}
