import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, IsBoolean,
  IsDateString, IsObject, IsNumber, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SystemAnnouncementResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    content: string;

    @ApiProperty({ required: false })
    summary?: string;

    @ApiProperty()
    type: string;

    @ApiProperty()
    priority: string;

    @ApiProperty()
    publishedAt: Date;

    @ApiProperty()
    createdAt: Date;
}

export class AdminSystemAnnouncementResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    content: string;

    @ApiPropertyOptional()
    summary?: string | null;

    @ApiProperty()
    targetAudience: string;

    @ApiPropertyOptional()
    brandId?: string | null;

    @ApiPropertyOptional()
    programId?: string | null;

    @ApiProperty()
    priority: string;

    @ApiProperty()
    type: string;

    @ApiProperty()
    isPublished: boolean;

    @ApiPropertyOptional()
    publishedAt?: Date | null;

    @ApiProperty()
    isDismissible: boolean;

    @ApiProperty()
    showBanner: boolean;

    @ApiPropertyOptional()
    actionUrl?: string | null;

    @ApiPropertyOptional()
    actionLabel?: string | null;

    @ApiPropertyOptional()
    startDate?: Date | null;

    @ApiPropertyOptional()
    endDate?: Date | null;

    @ApiProperty()
    metadata: Record<string, unknown>;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class CreateSystemAnnouncementDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    summary?: string;

    @ApiPropertyOptional({ enum: ['all', 'participants', 'ambassadors', 'specific_program'] })
    @IsOptional()
    @IsString()
    targetAudience?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    brandId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    programId?: string;

    @ApiPropertyOptional({ enum: ['low', 'normal', 'high', 'urgent'] })
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional({ enum: ['general', 'maintenance', 'deadline', 'feature', 'alert'] })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isDismissible?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    showBanner?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    actionUrl?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    actionLabel?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ description: 'Arbitrary metadata (e.g. imageUrl, author)' })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}

export class UpdateSystemAnnouncementDto extends PartialType(CreateSystemAnnouncementDto) {}

export class ListAllSystemAnnouncementsQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    brandId?: string;
}
