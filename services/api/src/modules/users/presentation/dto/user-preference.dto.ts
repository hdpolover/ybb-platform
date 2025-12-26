import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsBoolean, IsObject } from 'class-validator';

export class UpdateUserPreferenceDto {
    @ApiPropertyOptional({ enum: ['light', 'dark', 'auto'] })
    @IsOptional()
    @IsEnum(['light', 'dark', 'auto'])
    theme?: 'light' | 'dark' | 'auto';

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    language?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    dateFormat?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    emailNotifications?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    smsNotifications?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    marketingEmails?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    newsletterSubscription?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    programUpdates?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    applicationUpdates?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    reminderEmails?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    customSettings?: any;
}

export class UserPreferenceResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    userId: string;

    @ApiProperty({ enum: ['light', 'dark', 'auto'] })
    theme: string;

    @ApiProperty()
    language: string;

    @ApiProperty()
    timezone: string;

    @ApiProperty()
    dateFormat: string;

    @ApiProperty()
    emailNotifications: boolean;

    @ApiProperty()
    smsNotifications: boolean;

    @ApiProperty()
    marketingEmails: boolean;

    @ApiProperty()
    newsletterSubscription: boolean;

    @ApiProperty()
    programUpdates: boolean;

    @ApiProperty()
    applicationUpdates: boolean;

    @ApiProperty()
    reminderEmails: boolean;

    @ApiProperty()
    customSettings: any;

    @ApiProperty()
    updatedAt: Date;
}
