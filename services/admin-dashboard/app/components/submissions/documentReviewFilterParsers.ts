// services/admin-dashboard/app/components/submissions/documentReviewFilterParsers.ts

import { parseAsInteger, parseAsStringEnum } from "nuqs";

export const DOCUMENT_REVIEW_STATUS_VALUES = [
  "uploaded",
  "approved",
  "rejected",
  "revision_requested",
] as const;

export const DOCUMENT_REVIEW_PAGE_SIZE = 20;

// URL-persisted status filter and pagination for the agreement letter review
// queue. Defaults to "uploaded" per the plan: that is the actionable queue,
// the other statuses are for looking something up after the fact.
export const documentReviewFilterParsers = {
  status: parseAsStringEnum([...DOCUMENT_REVIEW_STATUS_VALUES])
    .withDefault("uploaded")
    .withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
};
