// services/api/src/modules/applications/application/dto/document-review-queue-response.dto.ts

export interface DocumentReviewQueueItemDto {
  id: string;
  applicationId: string;
  documentName: string;
  submissionStatus: string;
  submissionNote: string | null;
  signedCopyUrl: string | null;
  signedCopyUploadedAt: Date | null;
  generatedAt: Date;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  participantName: string;
  participantEmail: string | null;
  programName: string;
}

export interface DocumentReviewQueueResponseDto {
  items: DocumentReviewQueueItemDto[];
  total: number;
  limit: number;
  offset: number;
}
