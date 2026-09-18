// services/admin-dashboard/app/components/submissions/documentReviewHelpers.test.ts

import { describe, it, expect } from "vitest";
import { ApiError } from "@/src/shared/api-client";
import { canSubmitReview, describeReviewError, reviewActionRequiresNote } from "./documentReviewHelpers";

describe("reviewActionRequiresNote", () => {
  it("does not require a note to approve", () => {
    expect(reviewActionRequiresNote("approve")).toBe(false);
  });

  it("requires a note to decline", () => {
    expect(reviewActionRequiresNote("reject")).toBe(true);
  });

  it("requires a note to request a revision", () => {
    expect(reviewActionRequiresNote("request_revision")).toBe(true);
  });
});

describe("canSubmitReview", () => {
  it("allows approve with an empty note", () => {
    expect(canSubmitReview("approve", "")).toBe(true);
  });

  it("blocks decline with an empty or whitespace-only note", () => {
    expect(canSubmitReview("reject", "")).toBe(false);
    expect(canSubmitReview("reject", "   ")).toBe(false);
  });

  it("allows decline once a real note is entered", () => {
    expect(canSubmitReview("reject", "Signature page is missing")).toBe(true);
  });

  it("blocks request_revision with an empty note", () => {
    expect(canSubmitReview("request_revision", "")).toBe(false);
  });
});

describe("describeReviewError", () => {
  it("surfaces a specific message on a 409 conflict", () => {
    const err = new ApiError("Document was already reviewed by another admin.", 409);
    expect(describeReviewError(err)).toBe(
      "This document was already reviewed by someone else. Refresh and try again.",
    );
  });

  it("passes through other ApiError messages unchanged", () => {
    const err = new ApiError("A note is required to reject a document.", 400);
    expect(describeReviewError(err)).toBe("A note is required to reject a document.");
  });

  it("falls back to a generic message for a non-Error value", () => {
    expect(describeReviewError("boom")).toBe("Failed to submit the review.");
  });
});
