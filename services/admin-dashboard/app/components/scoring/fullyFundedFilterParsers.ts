// services/admin-dashboard/app/components/scoring/fullyFundedFilterParsers.ts

import { parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import {
  SORT_BY_VALUES,
  SORT_ORDER_VALUES,
  STATUS_VALUES,
  SCORE_STATUS_VALUES,
  REGISTRATION_PAYMENT_STATUS_VALUES,
  DEFAULT_PAGE_SIZE,
} from "./FullyFundedParticipantsFilters";

// URL-persisted filter/sort/pagination state (nuqs) — mirrors the pattern in
// app/programs/[programId]/participants/page.tsx. Category ("fully_funded")
// stays hardcoded per this page's purpose, so it isn't part of the URL state.
// `status` defaults to "submitted" (this page's historical scope) but is now
// a real, changeable filter — "all" sends no status filter to the API.
//
// Shared between FullyFundedParticipantsAll (the list) and the review queue
// (app/hooks/useApplicationQueue.ts) so both read/write the exact same URL
// shape and a link from the list into the queue lands on the identical page.
export const fullyFundedFilterParsers = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  // Defaults to every status, NOT "submitted": payment is what makes an
  // applicant scoreable, and reviewers must be able to see paid drafts in
  // order to force-submit them once the deadline passes.
  status: parseAsStringEnum([...STATUS_VALUES]).withDefault("all").withOptions({ clearOnDefault: true }),
  scoreStatus: parseAsStringEnum([...SCORE_STATUS_VALUES]).withDefault("all").withOptions({ clearOnDefault: true }),
  // Payment gates scoring eligibility — only paid registrants should show up
  // in the reviewer queue by default. "all" sends no filter (see task: the
  // reviewer can still opt into seeing everyone).
  registrationPaymentStatus: parseAsStringEnum([...REGISTRATION_PAYMENT_STATUS_VALUES])
    .withDefault("paid")
    .withOptions({ clearOnDefault: true }),
  sortBy: parseAsStringEnum([...SORT_BY_VALUES]).withDefault("updatedAt").withOptions({ clearOnDefault: true }),
  sortOrder: parseAsStringEnum([...SORT_ORDER_VALUES]).withDefault("desc").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  pageSize: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE).withOptions({ clearOnDefault: true }),
};
