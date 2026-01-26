import { IsString, IsBoolean, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FeeConfigDto {
    @ApiProperty()
    @IsNumber()
    fixed_fee: number;

    @ApiProperty()
    @IsNumber()
    percentage_fee: number;

    @ApiProperty()
    @IsNumber()
    min_fee: number;

    @ApiProperty()
    @IsString()
    currency: string;

    @ApiProperty()
    @IsBoolean()
    is_surcharge: boolean;
}

export class CreatePaymentMethodDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsString()
    type: string;

    @ApiProperty()
    @IsString()
    code: string;

    @ApiProperty()
    @IsBoolean()
    is_active: boolean;

    @ApiProperty()
    @IsString()
    display_name: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty()
    @IsString()
    icon: string;

    @ApiProperty()
    @IsString()
    gateway_name: string;

    @ApiProperty()
    @IsString()
    gateway_type: string;

    @ApiProperty()
    @IsString()
    bank_name: string;

    @ApiProperty()
    @IsString()
    account_number: string;

    @ApiProperty()
    @IsString()
    account_name: string;

    @ApiProperty()
    @IsString()
    instructions: string;

    @ApiProperty()
    @IsBoolean()
    requires_proof: boolean;

    @ApiProperty()
    @IsString()
    admin_instructions: string;

    @ApiProperty({ type: FeeConfigDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => FeeConfigDto)
    config?: FeeConfigDto;

    @ApiProperty()
    @IsNumber()
    sort_order: number;
}

export class UpdatePaymentMethodDto extends CreatePaymentMethodDto {}
