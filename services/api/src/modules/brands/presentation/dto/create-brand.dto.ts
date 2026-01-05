import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsEmail, IsBoolean, IsHexColor } from 'class-validator';

export class CreateBrandDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    slug?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ type: 'string', format: 'binary', required: false })
    @IsOptional()
    logo?: any;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUrl()
    logoUrl?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUrl()
    websiteUrl?: string;

    @ApiProperty({ required: false })
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
