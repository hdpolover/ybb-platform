import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for saving a submission section
 */
export class SaveSectionResponseDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'personal_info', enum: ['personal_info', 'essays', 'documents'] })
    section: string;
}

/**
 * Response DTO for submitting an application
 */
export class SubmitApplicationResponseDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    applicationId: string;

    @ApiProperty({ example: 'submitted' })
    status: string;
}

/**
 * Response DTO for certificate download
 */
export class DownloadCertificateResponseDto {
    @ApiProperty({ example: 'https://storage.ybb.center/certs/cert.pdf' })
    fileUrl: string;

    @ApiProperty({ example: 'Certificate of Participation.pdf' })
    fileName: string;
}
