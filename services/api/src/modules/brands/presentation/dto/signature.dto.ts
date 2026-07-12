import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsUUID, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSignatureDto {
    @ApiProperty({ description: 'Brand this signature belongs to' })
    @IsUUID()
    @IsNotEmpty()
    brandId: string;

    @ApiProperty({ example: 'Muhammad Aldi Subakti' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false, nullable: true, example: 'Program Director' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiProperty({ description: 'URL of the signature image' })
    @IsString()
    @IsNotEmpty()
    imageUrl: string;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    sortOrder?: number;
}

export class UpdateSignatureDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false, nullable: true })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    imageUrl?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    sortOrder?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class SignatureResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    brandId: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ nullable: true })
    title?: string;

    @ApiProperty()
    imageUrl: string;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty()
    sortOrder: number;
}
