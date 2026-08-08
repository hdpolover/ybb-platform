import { IsString, IsOptional, IsEnum, IsObject, IsArray, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationCategory } from '@core/entities/participant-application.entity';
import { DocumentFile } from '@core/entities/participant-application.entity';

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
  documents?: Record<string, DocumentFile>;

  @ApiPropertyOptional({ description: 'Requirement files' })
  @IsOptional()
  @IsArray()
  // Passthrough only, see create-application-request.dto.ts for why: this is
  // the participant-submit path and must not reject anything it accepts today.
  // Reads from `obj[key]` rather than destructuring `value` -- see that file
  // for why `value` is already corrupted by the time @Transform sees it.
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key])
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
