// services/api/src/modules/checkout/dto/checkout-config.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { CheckoutEdition } from '../checkout-policy.service';

/** Both preselect params are optional hints; an invalid pair just yields `selected: null`. */
export class CheckoutConfigQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(255)
    programSlug?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    tierId?: string;

    @ApiPropertyOptional({ enum: ApplicationCategory, description: 'Disambiguates a tier that allows several categories' })
    @IsOptional()
    @IsEnum(ApplicationCategory)
    category?: ApplicationCategory;
}

export class CheckoutConfigResponseDto {
    enabled!: boolean;
    turnstileSiteKey!: string | null;
    /** All open-registration editions of the brand with at least one valid option. */
    editions!: CheckoutEdition[];
    selected!: { programSlug: string; category: ApplicationCategory; tierId: string } | null;
}
