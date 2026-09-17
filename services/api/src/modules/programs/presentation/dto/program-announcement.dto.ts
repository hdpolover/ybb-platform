import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsNumber, Min, Max, IsDateString, MaxLength, Matches, ValidateBy, ValidationOptions } from 'class-validator';
import { Type } from 'class-transformer';
import { isUuid, URL_SLUG_MAX_LENGTH, URL_SLUG_PATTERN } from '@shared/utils/url-slug';

// The public page resolves /announcements/<key> as an id when the key is
// UUID-shaped and as a slug otherwise, so a UUID-shaped slug would be
// unreachable by its own URL.
function IsNotUuidShaped(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isNotUuidShaped',
      validator: {
        validate: (value: unknown) => typeof value !== 'string' || !isUuid(value),
        defaultMessage: () => 'slug must not look like a UUID',
      },
    },
    validationOptions,
  );
}

export class CreateProgramAnnouncementDto {
  @ApiProperty({ description: 'Announcement title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description:
      'URL slug for /announcements/<slug>: lowercase letters, digits and single hyphens. ' +
      'Generated from the title when omitted on create. Changing it on a published ' +
      'announcement breaks links that use the old slug.',
    example: 'kwon-hae-suk-explores-ai-for-inclusive-global-communities',
    maxLength: URL_SLUG_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(URL_SLUG_MAX_LENGTH)
  @Matches(URL_SLUG_PATTERN, {
    message: 'slug may only contain lowercase letters, digits and single hyphens, and cannot start or end with a hyphen',
  })
  @IsNotUuidShaped()
  slug?: string;

  @ApiProperty({ description: 'Announcement body content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Category (e.g. News, Award, Scholarship, General)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Target audience: all, applicants, accepted, rejected, participants' })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Whether to send email notification' })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({ description: 'Whether to pin this announcement' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'Optional image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'When the announcement should become publicly visible' })
  @IsOptional()
  @IsDateString()
  publishDate?: string;

  @ApiPropertyOptional({ description: 'Whether the announcement should be visible to users' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProgramAnnouncementDto extends PartialType(CreateProgramAnnouncementDto) {}

export class ListProgramAnnouncementsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by target audience' })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ProgramAnnouncementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  programId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ example: 'kwon-hae-suk-explores-ai-for-inclusive-global-communities' })
  slug: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiProperty()
  targetAudience: string;

  @ApiProperty()
  sendEmail: boolean;

  @ApiProperty()
  isPinned: boolean;

  @ApiProperty()
  publishDate: Date;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty()
  tags: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
