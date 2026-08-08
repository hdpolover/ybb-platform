import { IsString, IsOptional, IsEnum, IsObject, IsArray, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
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
  // Passthrough only, no @Type()/@ValidateNested() here on purpose: this is
  // the participant-submit path, and this DTO's elements have caused a
  // platform-wide submit outage before when validation on it was tightened.
  // Without this, class-transformer's implicit conversion (main.ts
  // ValidationPipe) rebuilds every element as `new Array()` since DocumentFile
  // is an interface with no constructor to reconstruct against. The
  // passthrough stops that reconstruction while leaving accepted payloads
  // exactly as they are today.
  //
  // Reads from `obj[key]` rather than destructuring `value`: class-transformer
  // runs the implicit design:type conversion BEFORE invoking @Transform, so
  // by the time a callback receives `value` it is already the corrupted
  // `new Array()` result. `obj[key]` is the untouched source property and is
  // the only way a @Transform callback can see the real payload here.
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
