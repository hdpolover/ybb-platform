import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export const DEFAULT_ANNOUNCEMENTS_LIMIT = 20;
export const MAX_ANNOUNCEMENTS_LIMIT = 100;

export class ListAnnouncementsQueryDto {
  // Not used by the strategy — brand resolution reads `url`/`x-brand-domain` straight off
  // the raw request (see BrandDomain decorator). Declared here only so the global
  // ValidationPipe's `forbidNonWhitelisted` doesn't 400 requests that pass `?url=`
  // alongside pagination/filter params.
  @ApiPropertyOptional({ description: 'Brand website URL (alternative to the x-brand-domain header)' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: DEFAULT_ANNOUNCEMENTS_LIMIT, minimum: 1, maximum: MAX_ANNOUNCEMENTS_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ANNOUNCEMENTS_LIMIT)
  limit?: number = DEFAULT_ANNOUNCEMENTS_LIMIT;

  @ApiPropertyOptional({ description: 'Search term matched against title/content' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category (e.g. News, General). Matched case-insensitively.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by a single tag' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by program/edition id' })
  @IsOptional()
  @IsString()
  programId?: string;

  @ApiPropertyOptional({ description: 'Filter to announcements published in this calendar year', example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
