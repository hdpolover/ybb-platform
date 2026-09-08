import { IsOptional, IsObject, IsString, IsNotEmpty, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsSubmissionDataEnglish } from '@shared/validators/submission-data-english.validator';
import { IsEnglishName, IsEnglishText } from '@shared/validators/english-text.validator';

// MaxLength on every string below mirrors its Postgres column exactly:
// participants.full_name VarChar(255), nick_name/display_name VarChar(100), and
// participant_applications.twibbon_link VarChar(500). Without them an overlong
// value reaches Postgres and raises 22001. PR #139 already maps that to a 4xx
// rather than an opaque 500, but the DTO is what lets the response NAME the
// field that was too long instead of blaming the request as a whole. Same
// defect class as the VarChar overflows already on record in this codebase.
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
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Participant nick / preferred name (English only)',
    example: 'Annie',
  })
  @IsOptional()
  @IsString()
  @IsEnglishName()
  @MaxLength(100)
  nickName?: string;

  @ApiPropertyOptional({
    description: 'Participant display name (English only)',
    example: 'Anne M.',
  })
  @IsOptional()
  @IsString()
  @IsEnglishName()
  @MaxLength(100)
  displayName?: string;
}

/**
 * Patch for ParticipantApplication's own text columns (these are stored
 * directly on the application row, NOT in the personalData JSON blob, and are
 * read back by the admin/participant views and document generation).
 */
export class AdminApplicationPatchDto {
  @ApiPropertyOptional({ description: 'Motivation letter (English only).' })
  @IsOptional()
  @IsString()
  @IsEnglishText()
  motivationLetter?: string;

  @ApiPropertyOptional({ description: 'Achievements (English only).' })
  @IsOptional()
  @IsString()
  @IsEnglishText()
  achievements?: string;

  @ApiPropertyOptional({ description: 'Experiences (English only).' })
  @IsOptional()
  @IsString()
  @IsEnglishText()
  experiences?: string;

  @ApiPropertyOptional({ description: 'Twibbon / social post link.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  twibbonLink?: string;
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

  @ApiPropertyOptional({
    description: 'Direct updates to ParticipantApplication text columns (motivation, achievements, etc.).',
    type: AdminApplicationPatchDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdminApplicationPatchDto)
  application?: AdminApplicationPatchDto;

  @ApiProperty({
    description: 'Why this edit was made — stored verbatim in the audit trail.',
    example: 'Corrected name typo before LoA generation',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
