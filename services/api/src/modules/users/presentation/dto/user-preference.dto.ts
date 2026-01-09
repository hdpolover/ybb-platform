import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsBoolean, IsObject } from 'class-validator';

export class UpdateUserPreferenceDto {
    @ApiPropertyOptional({
        enum: ['light', 'dark', 'auto'],
        description: 'Preferred UI theme.'
    })
    @IsOptional()
    @IsEnum(['light', 'dark', 'auto'])
    theme?: 'light' | 'dark' | 'auto';

    @ApiPropertyOptional({ example: 'en', description: 'Preferred language code (e.g., "en", "id").' })
    @IsOptional()
    @IsString()
    language?: string;

    @ApiPropertyOptional({ example: 'Asia/Jakarta', description: 'User timezone string.' })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional({ example: 'DD/MM/YYYY', description: 'Preferred date format.' })
    @IsOptional()
    @IsString()
    dateFormat?: string;

    @ApiPropertyOptional({ description: 'Enable or disable general email notifications.' })
    @IsOptional()
    @IsBoolean()
    emailNotifications?: boolean;

    @ApiPropertyOptional({ description: 'Enable or disable SMS notifications.' })
    @IsOptional()
    @IsBoolean()
    smsNotifications?: boolean;

    @ApiPropertyOptional({ description: 'Enable or disable marketing and promotional emails.' })
    @IsOptional()
    @IsBoolean()
    marketingEmails?: boolean;

    @ApiPropertyOptional({ description: 'Subscribe to the newsletter.' })
    @IsOptional()
    @IsBoolean()
    newsletterSubscription?: boolean;

    @ApiPropertyOptional({ description: 'Receive updates about registered programs.' })
    @IsOptional()
    @IsBoolean()
    programUpdates?: boolean;

    @ApiPropertyOptional({ description: 'Receive updates regarding application status.' })
    @IsOptional()
    @IsBoolean()
    applicationUpdates?: boolean;

    @ApiPropertyOptional({ description: 'Receive reminder emails for upcoming deadlines.' })
    @IsOptional()
    @IsBoolean()
    reminderEmails?: boolean;

    @ApiPropertyOptional({ description: 'JSON object for any other custom settings.' })
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
