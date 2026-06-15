import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsObject, Min, IsEmail, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class ItemDetailDto {
    @ApiProperty()
    @IsString()
    id: string;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsNumber()
    price: number;

    @ApiProperty()
    @IsNumber()
    quantity: number;
}

export class CreateIntentDto {
    @ApiProperty()
    @IsNumber()
    @Min(1)
    amount: number;

    @ApiProperty({ default: 'IDR' })
    @IsString()
    currency: string;

    @ApiProperty()
    @IsString()
    reference_type: string;

    @ApiProperty()
    @IsString()
    reference_id: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    participant_id?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    customer_name?: string;

    @ApiPropertyOptional()
    @NormalizeEmail()
    @IsEmail()
    @IsOptional()
    customer_email?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    customer_phone?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ type: [ItemDetailDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ItemDetailDto)
    @IsOptional()
    item_details?: ItemDetailDto[];

    @ApiPropertyOptional()
    @IsObject()
    @IsOptional()
    metadata?: Record<string, unknown>;
}
