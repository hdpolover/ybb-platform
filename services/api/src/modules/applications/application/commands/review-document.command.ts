// services/api/src/modules/applications/application/commands/review-document.command.ts
export type DocumentReviewAction = 'approve' | 'reject' | 'request_revision';

/**
 * Review Document Command
 *
 * Application Layer - Command
 *
 * Admin review of a participant's uploaded signed agreement letter.
 */
export class ReviewDocumentCommand {
  constructor(
    public readonly applicationId: string,
    public readonly documentId: string,
    public readonly reviewerId: string,
    public readonly action: DocumentReviewAction,
    public readonly note?: string,
  ) {}
}
