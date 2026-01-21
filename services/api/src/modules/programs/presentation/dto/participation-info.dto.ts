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
  benefits?: any[];

  @ApiPropertyOptional({ description: 'List of requirements (JSON)', isArray: true, type: 'object' })
  @IsArray()
  @IsOptional()
  requirements?: any[];

  @ApiPropertyOptional({ description: 'Custom sections', isArray: true, type: 'object' })
  @IsArray()
  @IsOptional()
  sections?: any[];

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
  benefits?: any[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  requirements?: any[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  sections?: any[];

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
  benefits: any;

  @ApiPropertyOptional()
  requirements: any;

  @ApiPropertyOptional()
  sections: any;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
