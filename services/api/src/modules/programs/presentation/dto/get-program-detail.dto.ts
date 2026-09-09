import { IsUUID, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetProgramDetailDto {
  @ApiProperty({
    description: 'Program ID or slug',
    example: '4202cef4-9e6d-4772-bea7-e01a719138fe',
  })
  @IsString()
  identifier: string;

  @ApiProperty({
    description: 'Include relations',
    example: 'all',
    required: false,
    enum: [
      'all',
      'basic',
      'payments',
      'content',
      'team',
      'requirements',
      'testimonials',
    ],
  })
  @IsOptional()
  @IsString()
  include?: string;

  @ApiProperty({
    description: 'Limit testimonials (pagination)',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  testimonialsLimit?: number;

  @ApiProperty({
    description: 'Limit announcements (pagination)',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  announcementsLimit?: number;

  @ApiProperty({
    description: 'Limit resources (pagination)',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  resourcesLimit?: number;
}

// Audit M33/M23: findOne (GET /programs/:identifier) is @Public() and used to
// bind these as raw @Query() params with no DTO, so @Min/@Max never ran and
// the Redis cache key was built from the unvalidated values (an attacker
// mints one 5-minute cache entry per distinct junk limit). GetProgramDetailDto
// above can't be bound directly to @Query() here: `identifier` is a route
// param, not a query param, and is required, so validating this DTO against
// the query string 400s every request. This is the same field set minus
// identifier, so the limits are clamped 1-50 (mirroring
// program-announcement.dto.ts's pattern) before the handler ever builds the
// cache key or reaches Prisma.
export class GetProgramDetailQueryDto {
  @ApiProperty({
    description: 'Include relations',
    example: 'all',
    required: false,
    enum: [
      'all',
      'basic',
      'payments',
      'content',
      'team',
      'requirements',
      'testimonials',
    ],
  })
  @IsOptional()
  @IsString()
  include?: string;

  @ApiProperty({
    description: 'Limit testimonials (pagination)',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  testimonialsLimit?: number;

  @ApiProperty({
    description: 'Limit announcements (pagination)',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  announcementsLimit?: number;

  @ApiProperty({
    description: 'Limit resources (pagination)',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  resourcesLimit?: number;
}
