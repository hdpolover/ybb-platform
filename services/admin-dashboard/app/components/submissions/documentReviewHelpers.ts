// services/admin-dashboard/app/components/submissions/documentReviewHelpers.ts

import { ApiError, type DocumentReviewAction } from "@/src/shared/api-client";

/** Decline and request-revision require a non-empty note; approve does not. */
export function reviewActionRequiresNote(action: DocumentReviewAction): boolean {
  return action === "reject" || action === "request_revision";
}

/** Gates the modal's submit button, mirroring the API's own note-required rule. */
export function canSubmitReview(action: DocumentReviewAction, note: string): boolean {
  return !reviewActionRequiresNote(action) || note.trim().length > 0;
}

/** Turns a review-submit failure into the message shown in the toast. */
export function describeReviewError(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) {
    return "This document was already reviewed by someone else. Refresh and try again.";
  }
  return err instanceof Error ? err.message : "Failed to submit the review.";
}
