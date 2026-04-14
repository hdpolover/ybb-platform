import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { AnnouncementType, AnnouncementPriority, AnnouncementTarget } from '@prisma/client';

export class CreateProgramAnnouncementDto {
  @ApiProperty({ description: 'Announcement title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Announcement body content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ enum: AnnouncementType, default: AnnouncementType.general })
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @ApiPropertyOptional({ enum: AnnouncementPriority, default: AnnouncementPriority.normal })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @ApiPropertyOptional({ enum: AnnouncementTarget, default: AnnouncementTarget.all })
  @IsOptional()
  @IsEnum(AnnouncementTarget)
  target?: AnnouncementTarget;

  @ApiPropertyOptional({ description: 'Announcement expiry date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Whether to display as a banner' })
  @IsOptional()
  @IsBoolean()
  showBanner?: boolean;
}

export class UpdateProgramAnnouncementDto extends PartialType(CreateProgramAnnouncementDto) {
  @ApiPropertyOptional({ description: 'Active/inactive status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListProgramAnnouncementsQueryDto {
  @ApiPropertyOptional({ enum: AnnouncementType })
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @ApiPropertyOptional({ enum: AnnouncementPriority })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

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

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: AnnouncementType })
  type: AnnouncementType;

  @ApiProperty({ enum: AnnouncementPriority })
  priority: AnnouncementPriority;

  @ApiProperty({ enum: AnnouncementTarget })
  target: AnnouncementTarget;

  @ApiPropertyOptional()
  expiresAt?: Date;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  showBanner: boolean;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
