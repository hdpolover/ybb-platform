import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsObject, Min } from 'class-validator';

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
    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
