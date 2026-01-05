import { ApiProperty } from '@nestjs/swagger';

export class BrandResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    slug: string;

    @ApiProperty({ required: false, nullable: true })
    description?: string | null;

    @ApiProperty({ required: false, nullable: true })
    logoUrl?: string | null;

    @ApiProperty({ required: false, nullable: true })
    websiteUrl?: string | null;

    @ApiProperty({ required: false, nullable: true })
    primaryColor?: string | null;

    @ApiProperty({ required: false, nullable: true })
    contactEmail?: string | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty({ required: false, nullable: true })
    deletedAt?: Date | null;
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
