import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProgramDto {
    @ApiProperty({ description: 'Brand ID', required: false })
    @IsUUID()
    @IsOptional()
    brandId?: string;

    @ApiProperty({ description: 'Program name', required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ description: 'Program slug', required: false })
    @IsString()
    @IsOptional()
    slug?: string;

    @ApiProperty({ description: 'Program description', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Short program description', required: false })
    @IsString()
    @IsOptional()
    shortDescription?: string;

    @ApiProperty({ description: 'Program year', required: false })
    @IsNumber()
    @IsOptional()
    year?: number;

    @ApiProperty({ description: 'Program theme', required: false })
    @IsString()
    @IsOptional()
    theme?: string;

    @ApiProperty({ description: 'Start date', required: false })
    @IsDateString()
    @IsOptional()
    startDate?: string;

    @ApiProperty({ description: 'End date', required: false })
    @IsDateString()
    @IsOptional()
    endDate?: string;

    @ApiProperty({ description: 'Application deadline', required: false })
    @IsDateString()
    @IsOptional()
    applicationDeadline?: string;

    @ApiProperty({ description: 'Location', required: false })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiProperty({ description: 'Capacity', required: false })
    @IsNumber()
    @IsOptional()
    capacity?: number;

    @ApiProperty({ description: 'Program status', required: false, example: 'draft' })
    @IsString()
    @IsOptional()
    status?: string;

    @ApiProperty({ description: 'Publish program immediately', required: false })
    @IsBoolean()
    @IsOptional()
    isPublished?: boolean;

    @ApiProperty({ description: 'Registration open date', required: false })
    @IsDateString()
    @IsOptional()
    registrationOpenDate?: string;

    @ApiProperty({ description: 'Registration close date', required: false })
    @IsDateString()
    @IsOptional()
    registrationCloseDate?: string;

    @ApiProperty({ description: 'Registration fee', required: false })
    @IsNumber()
    @IsOptional()
    registrationFee?: number;

    @ApiProperty({ description: 'Allow registration', required: false })
    @IsBoolean()
    @IsOptional()
    allowRegistration?: boolean;

    @ApiProperty({ description: 'Require email verification before accessing the program', required: false })
    @IsBoolean()
    @IsOptional()
    requireEmailVerification?: boolean;

    @ApiProperty({ description: 'Require payment', required: false })
    @IsBoolean()
    @IsOptional()
    requirePayment?: boolean;

    @ApiProperty({ description: 'Currency', required: false })
    @IsString()
    @IsOptional()
    currency?: string;

    @ApiProperty({ description: 'Requirements description', required: false })
    @IsString()
    @IsOptional()
    requirementsDescription?: string;

    @ApiProperty({ description: 'Benefits description', required: false })
    @IsString()
    @IsOptional()
    benefitsDescription?: string;

    @ApiProperty({ description: 'Terms and conditions', required: false })
    @IsString()
    @IsOptional()
    termsAndConditions?: string;

    @ApiProperty({ description: 'Is active', required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({ description: 'Is fully funded', required: false })
    @IsBoolean()
    @IsOptional()
    isFullyFunded?: boolean;

    @ApiProperty({ description: 'Exchange rate (1 USD = ? IDR) for this program', required: false, example: 16000 })
    @IsNumber()
    @IsOptional()
    usdInIdr?: number;

    @ApiProperty({ description: 'Main promo video URL', required: false })
    @IsString()
    @IsOptional()
    videoUrl?: string;

    @ApiProperty({ description: 'Meta title for SEO', required: false })
    @IsString()
    @IsOptional()
    metaTitle?: string;

    @ApiProperty({ description: 'Meta description for SEO', required: false })
    @IsString()
    @IsOptional()
    metaDescription?: string;

    @ApiProperty({ description: 'Whether the program is visible to users on the public site', required: false })
    @IsBoolean()
    @IsOptional()
    isVisibleToUsers?: boolean;

    @ApiProperty({ description: 'Logo image URL (assign from media library)', required: false })
    @IsString()
    @IsOptional()
    logoUrl?: string;

    @ApiProperty({ description: 'Banner image URL (assign from media library)', required: false })
    @IsString()
    @IsOptional()
    bannerUrl?: string;

    @ApiProperty({ description: 'Thumbnail image URL (assign from media library)', required: false })
    @IsString()
    @IsOptional()
    thumbnailUrl?: string;
}
