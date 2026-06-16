import { ApiProperty } from '@nestjs/swagger';

export class DocumentItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty({ enum: ['program_resource', 'participant_upload'] })
    category: string;

    @ApiProperty()
    fileUrl?: string;

    @ApiProperty({ enum: ['pending_upload', 'under_review', 'verified', 'rejected', 'optional', 'available'] })
    status: string;

    @ApiProperty({ required: false })
    rejectionReason?: string;

    @ApiProperty({ required: false }) signedCopyUrl?: string;
    @ApiProperty({ required: false }) submissionStatus?: string;
    @ApiProperty() documentType: string; // 'agreement_letter' | 'complementary_document' | 'program_resource' | 'letter_of_acceptance'
    @ApiProperty()
    updatedAt: Date;

    /**
     * LOA-specific: true = participant is eligible and can download on demand.
     * false = template exists but no released batch covers them yet (locked state).
     * Absent for non-LOA document types.
     */
    @ApiProperty({ required: false })
    downloadable?: boolean;

    /** LOA document number if one has already been assigned (optional). */
    @ApiProperty({ required: false })
    documentNumber?: string;
}

export class PortalDocumentResponseDto {
    @ApiProperty({ type: [DocumentItemDto] })
    programResources: DocumentItemDto[]; // Resources provided by the program

    @ApiProperty({ type: [DocumentItemDto] })
    myDocuments: DocumentItemDto[]; // Documents uploaded by the participant
}
