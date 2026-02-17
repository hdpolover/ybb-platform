import { ApiProperty } from '@nestjs/swagger';

export class ParticipantDocumentResponseDto {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    id: string;

    @ApiProperty({ example: 'CERT-2026-001', required: false })
    documentNumber: string | null;

    @ApiProperty({ example: 'https://storage.ybb.center/docs/cert.pdf', description: 'Public URL to download the document' })
    documentUrl: string;

    @ApiProperty({ example: '2026-02-17T07:00:00Z' })
    generatedAt: Date;

    @ApiProperty({ example: 'Official Certificate of Participation' })
    templateName: string;
}

export class ParticipantAwardResponseDto {
    @ApiProperty({ example: 'award-uuid-123' })
    id: string;

    @ApiProperty({ example: 'Best Delegate' })
    awardName: string;

    @ApiProperty({ example: 'Awarded for exceptional performance in the summit.', required: false })
    awardDescription: string | null;

    @ApiProperty({ example: 'https://storage.ybb.center/badges/best-delegate.png', required: false })
    badgeUrl: string | null;

    @ApiProperty({ example: '2026-02-17T07:00:00Z' })
    awardedAt: Date;

    @ApiProperty({ example: 'https://storage.ybb.center/certs/best-delegate.pdf', required: false })
    certificateUrl: string | null;
}
