import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsNumber, Min } from 'class-validator';

export class UpdateBrandSettingsDto {
    @ApiProperty({ required: false, description: 'Whether users must verify email before accessing dashboard.' })
    @IsOptional()
    @IsBoolean()
    requireEmailVerification?: boolean;

    @ApiProperty({ required: false, example: 'USD', description: 'Default currency code.' })
    @IsOptional()
    @IsString()
    defaultCurrency?: string;

    @ApiProperty({ required: false, description: 'Enable multi-currency support.' })
    @IsOptional()
    @IsBoolean()
    enableMultiCurrency?: boolean;
    
    // Configs from BrandSetting
    @ApiProperty({ required: false, description: 'Enable maintenance mode for this brand.' })
    @IsOptional()
    @IsBoolean()
    isMaintenanceMode?: boolean;

    @ApiProperty({ required: false, description: 'Message to display during maintenance.' })
    @IsOptional()
    @IsString()
    maintenanceMessage?: string;

    @ApiProperty({ 
        required: false,
        description: 'JSON object defining the footer navigation structure.',
        example: { 
            columns: [
                { title: "Programs", links: [{ label: "Summit", url: "/summit" }] }
            ] 
        }
    })
    @IsOptional()
    footerNavigation?: any;

    @ApiProperty({ required: false, description: 'Exchange rate (1 USD = ? IDR).', example: 16000 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    usdInIdr?: number;

    @ApiProperty({ required: false, description: 'Google Analytics Measurement ID.' })
    @IsOptional()
    @IsString()
    googleAnalyticsId?: string;

    @ApiProperty({ required: false, description: 'Facebook Pixel ID.' })
    @IsOptional()
    @IsString()
    pixelId?: string;

    @ApiProperty({ required: false, description: 'Email address for support inquiries.' })
    @IsOptional()
    @IsString()
    supportEmail?: string;
}
