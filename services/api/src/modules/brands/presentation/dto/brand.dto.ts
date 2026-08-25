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
    tagline?: string | null;

    @ApiProperty({ required: false, nullable: true })
    logoUrl?: string | null;

    @ApiProperty({ required: false, nullable: true })
    logoIconUrl?: string | null;

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

    @ApiProperty({
        required: false,
        nullable: true,
        description:
            'The brand\'s active program (see active-program-resolver.ts), used by the admin UI to warn ' +
            'when the program\'s own logoUrl is shadowing this brand\'s logo on the public site ' +
            '(settings.strategy.ts prefers program.logoUrl over brand.logoUrl).',
    })
    activeProgram?: { id: string; slug: string; logoUrl: string | null } | null;
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

export class SocialFeedResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    platform: string;

    @ApiProperty()
    postId: string;

    @ApiProperty()
    permalink: string;

    @ApiProperty()
    imageUrl: string;

    @ApiProperty({ required: false })
    caption?: string;

    @ApiProperty()
    postedAt: Date;

    @ApiProperty()
    isActive: boolean;
}
