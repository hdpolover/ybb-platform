// services/api/src/modules/applications/application/queries/get-document-review-queue.query.ts

/** Mirrors REVIEW_ACTION_STATUS in review-document.handler.ts plus the display-only 'pending_upload' state. */
export type DocumentReviewStatus = 'uploaded' | 'approved' | 'rejected' | 'revision_requested';

export class GetDocumentReviewQueueQuery {
  constructor(
    public readonly programId: string,
    public readonly status: DocumentReviewStatus = 'uploaded',
    public readonly limit: number = 20,
    public readonly offset: number = 0,
  ) {}
}
