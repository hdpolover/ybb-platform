
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum StatSection {
  IMPACT = 'impact',
  GEOGRAPHY = 'geography',
}

export class GetStatsQueryDto {
  @ApiPropertyOptional({
    description: 'Sections to retrieve. If empty, retrieves all.',
    enum: StatSection,
    isArray: true,
  })
  @IsOptional()
  @IsEnum(StatSection, { each: true })
  sections?: StatSection[];

  @ApiPropertyOptional({ description: 'URL to resolve program category context' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Specific Brand ID (formerly Program Category ID)' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Page number for pagination lists (e.g. geography)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page for pagination lists', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
