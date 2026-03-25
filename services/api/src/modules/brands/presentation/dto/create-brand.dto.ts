import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsEmail, IsBoolean, IsHexColor } from 'class-validator';

export class CreateBrandDto {
    @ApiProperty({ description: 'Name of the brand/program category', example: 'Istanbul Youth Summit' })
    @IsString()
    name: string;

    @ApiProperty({ required: false, description: 'Unique slug for the brand URLs', example: 'istanbul-youth-summit' })
    @IsOptional()
    @IsString()
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

    @ApiProperty({ required: false, example: '#FF0000' })
    @IsOptional()
    @IsHexColor()
    primaryColor?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    contactEmail?: string;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
