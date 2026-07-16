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
