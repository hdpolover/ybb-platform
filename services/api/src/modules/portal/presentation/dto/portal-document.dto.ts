import { ApiProperty } from '@nestjs/swagger';

export class DocumentItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty({ enum: ['program_resource', 'participant_upload', 'document_template'] })
    category: string;

    @ApiProperty()
    fileUrl?: string;

    // For agreement letters this mirrors submissionStatus exactly (see
    // get-portal-documents.handler.ts's `participantDoc?.submissionStatus ??
    // 'pending_upload'`), so the two fields cannot drift for that
    // documentType. 'available' and 'verified' are produced only for the
    // other branches (program resources, complementary docs, the LOA tile),
    // never for agreement letters.
    @ApiProperty({
        enum: [
            'not_required',
            'pending_upload',
            'uploaded',
            'approved',
            'rejected',
            'revision_requested',
            'available',
            'verified',
        ],
    })
    status: string;

    @ApiProperty({ required: false }) signedCopyUrl?: string;
    @ApiProperty({ required: false }) submissionStatus?: string;
    @ApiProperty({ required: false, description: 'Reviewer note shown verbatim for rejected/revision_requested' })
    submissionNote?: string;
    @ApiProperty({ required: false }) signedCopyUploadedAt?: Date;
    @ApiProperty({ required: false, description: 'Admin id (admins.id) who reviewed this document' })
    reviewedBy?: string;
    @ApiProperty({ required: false }) reviewedAt?: Date;
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
