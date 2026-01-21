import { ApiProperty } from '@nestjs/swagger';

export class LegalDocumentResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    programCategoryId: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    slug: string;

    @ApiProperty()
    content: string;

    @ApiProperty()
    version: string;

    @ApiProperty({ required: false })
    description?: string | null;

    @ApiProperty()
    isRequired: boolean;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty({ required: false })
    publishedAt?: Date | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}
