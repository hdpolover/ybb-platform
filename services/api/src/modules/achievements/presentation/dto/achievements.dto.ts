import { ApiProperty } from '@nestjs/swagger';

export class ParticipantDocumentResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    documentNumber: string | null;

    @ApiProperty()
    documentUrl: string;

    @ApiProperty()
    generatedAt: Date;

    @ApiProperty()
    templateName: string;
}

export class ParticipantAwardResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    awardName: string;

    @ApiProperty({ required: false })
    awardDescription: string | null;

    @ApiProperty({ required: false })
    badgeUrl: string | null;

    @ApiProperty()
    awardedAt: Date;

    @ApiProperty({ required: false })
    certificateUrl: string | null;
}
