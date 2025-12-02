import { IsString, IsOptional, IsEnum, IsObject, IsArray, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationCategory } from '@core/entities/participant-application.entity';

/**
 * Update Application Request DTO
 * 
 * Presentation Layer - API Request DTO
 */
export class UpdateApplicationRequestDto {
  @ApiPropertyOptional({ enum: ApplicationCategory })
  @IsOptional()
  @IsEnum(ApplicationCategory)
  applicationCategory?: ApplicationCategory;

  @ApiPropertyOptional({ description: 'Motivation letter' })
  @IsOptional()
  @IsString()
  motivationLetter?: string;

  @ApiPropertyOptional({ description: 'Achievements' })
  @IsOptional()
  @IsString()
  achievements?: string;

  @ApiPropertyOptional({ description: 'Experiences' })
  @IsOptional()
  @IsString()
  experiences?: string;

  @ApiPropertyOptional({ description: 'Documents metadata' })
  @IsOptional()
  @IsObject()
  documents?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Requirement files' })
  @IsOptional()
  @IsArray()
  requirementFiles?: any[];

  @ApiPropertyOptional({ description: 'Twibbon link' })
  @IsOptional()
  @IsString()
  twibbonLink?: string;

  @ApiPropertyOptional({ description: 'Pricing tier ID' })
  @IsOptional()
  @IsUUID()
  pricingTierId?: string;
}
