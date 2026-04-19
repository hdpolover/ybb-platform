import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSponsorDto {
    @ApiProperty({ example: 'Asia Innovation Fund' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'corporate', description: 'corporate, ngo, media_partner, government, academic, individual, other' })
    @IsString()
    type: string;

    @ApiProperty({ required: false, nullable: true, example: 'platinum', description: 'platinum, gold, silver, bronze, partner' })
    @IsOptional()
    @IsString()
    tier?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    websiteUrl?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    order?: number;
}

export class UpdateSponsorDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    tier?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    websiteUrl?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    order?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
