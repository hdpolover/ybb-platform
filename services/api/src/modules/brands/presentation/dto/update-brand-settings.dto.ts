import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsNumber, Min, IsIn } from 'class-validator';

export class UpdateBrandSettingsDto {
    @ApiProperty({ required: false, description: 'Whether users must verify email before accessing dashboard.' })
    @IsOptional()
    @IsBoolean()
    requireEmailVerification?: boolean;

    // Settlement currency is driven at the program / pricing-tier / invoice level
    // (IDR base + USD via usdInIdr rate). This brand-level field is not consumed by
    // any pricing or display logic; constrain it to the currencies the system can
    // actually settle in so it can't be set to something misleading (e.g. CNY).
    @ApiProperty({ required: false, example: 'IDR', description: 'Default currency code (display only; not used for settlement).' })
    @IsOptional()
    @IsIn(['USD', 'IDR'])
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
    footerNavigation?: Record<string, unknown>;

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
