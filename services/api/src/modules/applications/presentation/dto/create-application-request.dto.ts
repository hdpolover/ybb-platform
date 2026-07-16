import { IsString, IsOptional, IsEnum, IsObject, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationCategory } from '@core/entities/participant-application.entity';
import { DocumentFile } from '@core/entities/participant-application.entity';
import { IsEnglishText } from '@shared/validators/english-text.validator';

/**
 * Create Application Request DTO
 * 
 * Presentation Layer - API Request DTO
 */
export class CreateApplicationRequestDto {
  @ApiProperty({ description: 'Participant user ID' })
  @IsUUID()
  participantId: string;

  @ApiProperty({ description: 'Program ID' })
  @IsUUID()
  programId: string;

  @ApiPropertyOptional({ enum: ApplicationCategory })
  @IsOptional()
  @IsEnum(ApplicationCategory)
  applicationCategory?: ApplicationCategory;

  @ApiPropertyOptional({ description: 'Motivation letter' })
  @IsOptional()
  @IsString()
  @IsEnglishText()
  motivationLetter?: string;

  @ApiPropertyOptional({ description: 'Achievements' })
  @IsOptional()
  @IsString()
  @IsEnglishText()
  achievements?: string;

  @ApiPropertyOptional({ description: 'Experiences' })
  @IsOptional()
  @IsString()
  @IsEnglishText()
  experiences?: string;

  @ApiPropertyOptional({ description: 'Documents metadata' })
  @IsOptional()
  @IsObject()
  documents?: Record<string, DocumentFile>;

  @ApiPropertyOptional({ description: 'Requirement files' })
  @IsOptional()
  @IsArray()
  requirementFiles?: DocumentFile[];

  @ApiPropertyOptional({ description: 'Twibbon link' })
  @IsOptional()
  @IsString()
  twibbonLink?: string;

  @ApiPropertyOptional({ description: 'Pricing tier ID' })
  @IsOptional()
  @IsUUID()
  pricingTierId?: string;
}
