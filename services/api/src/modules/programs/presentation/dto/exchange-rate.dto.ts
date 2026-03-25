import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateExchangeRateDto {
    @ApiProperty({ description: 'Exchange rate (1 USD = ? IDR)', example: 16000 })
    @IsNumber()
    @Min(0)
    usdInIdr: number;

    @ApiProperty({ description: 'Reason for changing the exchange rate', required: false })
    @IsString()
    @IsOptional()
    reason?: string;
}

export class ExchangeRateResponseDto {
    @ApiProperty() programId: string;
    @ApiProperty() usdInIdr: number;
    @ApiProperty() source: 'program' | 'brand';
    @ApiProperty() updatedAt: Date;
}

export class ExchangeRateHistoryItemDto {
    @ApiProperty() id: string;
    @ApiProperty() oldRate: number;
    @ApiProperty() newRate: number;
    @ApiProperty() changedBy: string;
    @ApiProperty({ required: false }) reason?: string;
    @ApiProperty() createdAt: Date;
}

export class ExchangeRateHistoryResponseDto {
    @ApiProperty({ type: [ExchangeRateHistoryItemDto] }) history: ExchangeRateHistoryItemDto[];
    @ApiProperty() total: number;
}
