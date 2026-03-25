import { IsEnum, IsString, IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationCategory } from '@prisma/client';

export class CreateParticipationInfoDto {
  @ApiProperty({ description: 'Category', enum: ApplicationCategory })
  @IsEnum(ApplicationCategory)
  category: ApplicationCategory;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heroTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heroDescription?: string;

  @ApiPropertyOptional({ description: 'List of benefits (JSON)', isArray: true, type: 'object' })
  @IsArray()
  @IsOptional()
  benefits?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'List of requirements (JSON)', isArray: true, type: 'object' })
  @IsArray()
  @IsOptional()
  requirements?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Custom sections', isArray: true, type: 'object' })
  @IsArray()
  @IsOptional()
  sections?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateParticipationInfoDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heroTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heroDescription?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  benefits?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  requirements?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  sections?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ParticipationInfoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  programId: string;

  @ApiProperty({ enum: ApplicationCategory })
  category: ApplicationCategory;

  @ApiPropertyOptional()
  heroTitle?: string;

  @ApiPropertyOptional()
  heroDescription?: string;

  @ApiPropertyOptional()
  benefits: Record<string, unknown>[] | null;

  @ApiPropertyOptional()
  requirements: Record<string, unknown>[] | null;

  @ApiPropertyOptional()
  sections: Record<string, unknown>[] | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
