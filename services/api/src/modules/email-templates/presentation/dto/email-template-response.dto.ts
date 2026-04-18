import { ApiProperty } from '@nestjs/swagger';

export class EmailTemplateResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ required: false, nullable: true })
    brandId?: string | null;

    @ApiProperty({ required: false, nullable: true })
    programId?: string | null;

    @ApiProperty()
    name: string;

    @ApiProperty()
    type: string;

    @ApiProperty()
    subject: string;

    @ApiProperty()
    body: string;

    @ApiProperty({ type: Object, required: false, nullable: true })
    variables?: unknown;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}
