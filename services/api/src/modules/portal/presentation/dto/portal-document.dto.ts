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

    @ApiProperty()
    updatedAt: Date;
}

export class PortalDocumentResponseDto {
    @ApiProperty({ type: [DocumentItemDto] })
    programResources: DocumentItemDto[]; // Resources provided by the program

    @ApiProperty({ type: [DocumentItemDto] })
    myDocuments: DocumentItemDto[]; // Documents uploaded by the participant
}
