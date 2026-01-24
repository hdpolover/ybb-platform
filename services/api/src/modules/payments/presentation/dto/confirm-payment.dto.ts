import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsObject, IsNotEmpty, IsOptional } from 'class-validator';

export class ConfirmPaymentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    payment_method_id: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    gateway_token?: string;

    @ApiPropertyOptional()
    @IsObject()
    @IsOptional()
    payment_details?: Record<string, any>;
}
