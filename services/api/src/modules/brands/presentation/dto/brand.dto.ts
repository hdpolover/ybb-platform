import { ApiProperty } from '@nestjs/swagger';

export class BrandResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    slug: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty({ required: false })
    logoUrl?: string;

    @ApiProperty({ required: false })
    websiteUrl?: string;

    @ApiProperty({ required: false })
    primaryColor?: string;

    @ApiProperty({ required: false })
    contactEmail?: string;

    @ApiProperty()
    createdAt: Date;
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

    @ApiProperty()
    order: number;
}
