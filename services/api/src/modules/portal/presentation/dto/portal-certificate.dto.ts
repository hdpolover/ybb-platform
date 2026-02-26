import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Individual certificate item in the portal certificates list
 */
export class PortalCertificateItemDto {
    @ApiProperty({ example: 'doc-uuid-123' })
    id: string;

    @ApiPropertyOptional({ example: 'CERT-2026-001' })
    documentNumber?: string;

    @ApiProperty({ example: 'Certificate of Participation' })
    name: string;

    @ApiProperty({ example: 'certificate', enum: ['certificate', 'letter', 'invoice', 'agreement'] })
    type: string;

    @ApiProperty({ example: 'https://storage.example.com/certs/cert.pdf' })
    fileUrl: string;

    @ApiProperty({ example: 'pdf' })
    fileType: string;

    @ApiProperty({ example: 'YBB Summer Program 2026' })
    programName: string;

    @ApiProperty({ example: '2026-02-17T07:00:00Z' })
    generatedAt: Date;

    @ApiProperty({ example: 5 })
    downloadCount: number;
}

/**
 * Response for portal certificates list
 */
export class PortalCertificatesResponseDto {
    @ApiProperty({ type: [PortalCertificateItemDto] })
    certificates: PortalCertificateItemDto[];

    @ApiProperty({ example: 3 })
    total: number;
}
