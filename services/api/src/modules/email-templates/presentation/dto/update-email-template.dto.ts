import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsArray } from 'class-validator';

export class UpdateEmailTemplateDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    subject?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    body?: string;

    @ApiProperty({ type: [String], required: false })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    variables?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
