import { ApiProperty } from '@nestjs/swagger';

export class BrandResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ example: 'Istanbul Youth Summit' })
    name: string;

    @ApiProperty({ example: 'istanbul-youth-summit' })
    slug: string;

    @ApiProperty({ required: false, nullable: true })
    description?: string | null;

    @ApiProperty({ required: false, nullable: true })
    logoUrl?: string | null;

    @ApiProperty({ required: false, nullable: true })
    bannerUrl?: string | null;

    @ApiProperty({ required: false, nullable: true })
    websiteUrl?: string | null;

    @ApiProperty({ required: false, nullable: true, description: 'Canonical public landing deployment URL.' })
    landingUrl?: string | null;

    @ApiProperty({ required: false, nullable: true })
    primaryColor?: string | null;

    @ApiProperty({ required: false, nullable: true })
    about?: string | null;

    @ApiProperty({ required: false, nullable: true })
    vision?: string | null;

    @ApiProperty({ required: false, nullable: true })
    mission?: string | null;

    @ApiProperty({ required: false, nullable: true })
    contactEmail?: string | null;

    @ApiProperty({ required: false, nullable: true })
    contactPhone?: string | null;

    @ApiProperty({ required: false, nullable: true })
    contactWhatsapp?: string | null;

    @ApiProperty({ required: false, nullable: true })
    contactAddress?: string | null;

    @ApiProperty({ required: false, nullable: true, example: { instagram: '...' } })
    socialMediaLinks?: Record<string, string> | null;

    @ApiProperty({ required: false, nullable: true })
    defaultLocation?: string | null;

    @ApiProperty({ required: false, nullable: true })
    defaultCountry?: string | null;

    @ApiProperty({ required: false, nullable: true })
    defaultTimezone?: string | null;

    @ApiProperty()
    requireEmailVerification: boolean;

    @ApiProperty({ example: 'USD' })
    defaultCurrency: string;

    @ApiProperty()
    enableMultiCurrency: boolean;

    @ApiProperty({ required: false, nullable: true })
    metaTitle?: string | null;

    @ApiProperty({ required: false, nullable: true })
    metaDescription?: string | null;

    @ApiProperty({ required: false, nullable: true })
    metaKeywords?: string | null;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty({ example: 3 })
    programCount: number;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty({ required: false, nullable: true })
    deletedAt?: Date | null;

    @ApiProperty({ required: false, nullable: true, description: 'Brand-specific settings like footer config.' })
    settings?: Record<string, unknown> | null; // Detailed settings object
}

export class SponsorResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    type: string;

    @ApiProperty({ required: false })
    logoUrl?: string;

    @ApiProperty({ required: false })
    websiteUrl?: string;

    @ApiProperty({ required: false })
    tier?: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty()
    order: number;
}
