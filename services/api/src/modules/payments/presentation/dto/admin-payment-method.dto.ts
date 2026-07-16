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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    display_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    icon?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    gateway_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    gateway_type?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    bank_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    account_number?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    account_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    instructions?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    requires_proof?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    admin_instructions?: string;

    @ApiProperty({ type: FeeConfigDto, required: false })
    @IsOptional()
    @ValidateNested()
    @Type(() => FeeConfigDto)
    config?: FeeConfigDto;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    sort_order?: number;
}

export class UpdatePaymentMethodDto extends CreatePaymentMethodDto {}
