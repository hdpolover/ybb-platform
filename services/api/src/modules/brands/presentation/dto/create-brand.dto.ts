import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsBoolean, IsHexColor, MaxLength } from 'class-validator';

export class CreateBrandDto {
    @ApiProperty({ description: 'Name of the brand/program category', example: 'Istanbul Youth Summit' })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiProperty({ required: false, description: 'Unique slug for the brand URLs', example: 'istanbul-youth-summit' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    slug?: string;

    @ApiProperty({ required: false, description: 'Short description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'Logo file' })
    @IsOptional()
    logo?: Express.Multer.File;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUrl()
    logoUrl?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false, description: 'Banner file' })
    @IsOptional()
    banner?: Express.Multer.File;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUrl()
    bannerUrl?: string;

    @ApiProperty({ required: false, description: 'Brand website URL' })
    @IsOptional()
    @IsUrl()
    websiteUrl?: string;

    @ApiProperty({ required: false, description: 'Canonical public landing deployment URL (e.g. https://chinayouthsummit.com). Used to trigger cache revalidation when brand data changes.' })
    @IsOptional()
    @IsUrl()
    landingUrl?: string;

    // @IsHexColor delegates to validator.js, which also accepts 8-hex-digit alpha forms
    // (e.g. '#12345678', 9 chars) — MaxLength(7) closes the gap so it can't overflow
    // Brand.primaryColor VARCHAR(7).
    @ApiProperty({ required: false, example: '#FF0000' })
    @IsOptional()
    @IsHexColor()
    @MaxLength(7)
    primaryColor?: string;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
