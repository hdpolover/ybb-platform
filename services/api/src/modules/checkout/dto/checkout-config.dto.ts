// services/api/src/modules/checkout/dto/checkout-config.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CheckoutConfigQueryDto {
    @ApiProperty()
    @IsString()
    @MaxLength(255)
    programSlug!: string;

    @ApiProperty()
    @IsUUID()
    tierId!: string;

    @ApiPropertyOptional({ enum: ApplicationCategory, description: 'Only needed when the tier allows several categories' })
    @IsOptional()
    @IsEnum(ApplicationCategory)
    category?: ApplicationCategory;
}

export class CheckoutQuoteDto {
    programName!: string;
    programSlug!: string;
    tierId!: string;
    tierName!: string;
    category!: ApplicationCategory;
    amount!: number;
    currency!: string;
    amountIdr?: number;
}

export class CheckoutConfigResponseDto {
    enabled!: boolean;
    /** null when the flag is off. */
    quote!: CheckoutQuoteDto | null;
    turnstileSiteKey!: string | null;
}
