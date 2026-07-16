import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class UpdateBrandDetailsDto {
    @ApiProperty({ required: false, description: 'Brief description of the brand/program category.' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false, description: 'Longer "About Us" text.' })
    @IsOptional()
    @IsString()
    about?: string;

    @ApiProperty({ required: false, description: 'Vision statement.' })
    @IsOptional()
    @IsString()
    vision?: string;

    @ApiProperty({ required: false, description: 'Mission statement.' })
    @IsOptional()
    @IsString()
    mission?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'Logo image file (PNG/JPG).' })
    @IsOptional()
    logo?: Express.Multer.File;

    @ApiProperty({ required: false, description: 'Direct URL to logo if not uploading a file.' })
    @IsOptional()
    @IsUrl()
    logoUrl?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'Banner/Hero image file (PNG/JPG).' })
    @IsOptional()
    banner?: Express.Multer.File;

    @ApiProperty({ required: false, description: 'Direct URL to banner if not uploading a file.' })
    @IsOptional()
    @IsUrl()
    bannerUrl?: string;

    @ApiProperty({ required: false, example: '#FF0000', description: 'Primary brand color (Hex).' })
    @IsOptional()
    @IsString()
    primaryColor?: string;

    @ApiProperty({ required: false, example: 'https://ybbhub.com' })
    @IsOptional()
    @IsUrl()
    websiteUrl?: string;

    @ApiProperty({ required: false, example: 'https://chinayouthsummit.com', description: 'Landing deployment URL — drives cache revalidation.' })
    @IsOptional()
    @IsUrl()
    landingUrl?: string;

    @ApiProperty({ required: false, example: 'contact@example.com' })
    @IsOptional()
    @NormalizeEmail()
    @IsEmail()
    contactEmail?: string;

    @ApiProperty({ required: false, example: '+628123456789' })
    @IsOptional()
    @IsString()
    contactPhone?: string;

    @ApiProperty({ required: false, example: '628123456789' })
    @IsOptional()
    @IsString()
    contactWhatsapp?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    contactAddress?: string;

    @ApiProperty({
        required: false,
        description: 'JSON object of social media links (e.g., {"instagram": "...", "linkedin": "..."})',
        example: { instagram: 'https://instagram.com/ybb', linkedin: 'https://linkedin.com/company/ybb' }
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return value; }
        }
        return value;
    })
    socialMediaLinks?: Record<string, string>;

    @ApiProperty({ required: false, example: 'Jakarta, Indonesia' })
    @IsOptional()
    @IsString()
    defaultLocation?: string;

    @ApiProperty({ required: false, example: 'Indonesia' })
    @IsOptional()
    @IsString()
    defaultCountry?: string;

    @ApiProperty({ required: false, example: 'Asia/Jakarta' })
    @IsOptional()
    @IsString()
    defaultTimezone?: string;

    @ApiProperty({ required: false, description: 'SEO Meta Title' })
    @IsOptional()
    @IsString()
    metaTitle?: string;

    @ApiProperty({ required: false, description: 'SEO Meta Description' })
    @IsOptional()
    @IsString()
    metaDescription?: string;

    @ApiProperty({ required: false, description: 'SEO Keywords (comma separated)' })
    @IsOptional()
    @IsString()
    metaKeywords?: string;
}
