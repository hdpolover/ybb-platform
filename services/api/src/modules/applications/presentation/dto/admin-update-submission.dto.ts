import { IsOptional, IsObject, IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsSubmissionDataEnglish } from '@shared/validators/submission-data-english.validator';
import { IsEnglishName } from '@shared/validators/english-text.validator';

/**
 * Patch for Participant table columns that appear on generated documents
 * (LoA, ID cards, certificates).  Only the fields relevant to document
 * generation are exposed.  Every field is optional; supply only what needs
 * to change.
 */
export class AdminParticipantPatchDto {
  @ApiPropertyOptional({
    description: 'Participant full name (English only — used on LoA / ID card)',
    example: "Anne-Marie O'Brien",
  })
  @IsOptional()
  @IsString()
  @IsEnglishName()
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Participant nick / preferred name (English only)',
    example: 'Annie',
  })
  @IsOptional()
  @IsString()
  @IsEnglishName()
  nickName?: string;

  @ApiPropertyOptional({
    description: 'Participant display name (English only)',
    example: 'Anne M.',
  })
  @IsOptional()
  @IsString()
  @IsEnglishName()
  displayName?: string;
}

/**
 * AdminUpdateSubmissionDto
 *
 * Payload for PATCH /applications/:id/submission-data (admin only).
 *
 * All JSON patch fields are shallow-merged into the existing stored JSON so
 * the caller only needs to supply the keys they want to change.  The `reason`
 * field is mandatory and becomes the audit-trail entry for this edit.
 */
export class AdminUpdateSubmissionDto {
  @ApiPropertyOptional({
    description:
      'Partial map of personalData fields to overwrite.  Keys matching /name/i are ' +
      'validated as English names; all other string values must use printable ASCII.',
    example: { full_name: 'Jane Doe', date_of_birth: '1999-12-31' },
  })
  @IsOptional()
  @IsObject()
  @IsSubmissionDataEnglish()
  personalData?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Partial map of essayAnswers fields to overwrite.',
    example: { motivation: 'I want to join because...' },
  })
  @IsOptional()
  @IsObject()
  essayAnswers?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Direct updates to Participant table columns used on official documents.',
    type: AdminParticipantPatchDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdminParticipantPatchDto)
  participant?: AdminParticipantPatchDto;

  @ApiProperty({
    description: 'Why this edit was made — stored verbatim in the audit trail.',
    example: 'Corrected name typo before LoA generation',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
