// services/admin-dashboard/lib/application-badges.ts
// Status -> colour/label maps shared by the participants list and the participant detail header.

export const PAYMENT_BADGE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  processing: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  UNPAID: "bg-red-50 text-red-700",
  unpaid: "bg-red-50 text-red-700",
};

export const STATUS_BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  interview_scheduled: "bg-purple-50 text-purple-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  waitlisted: "bg-orange-50 text-orange-700",
  withdrawn: "bg-zinc-100 text-zinc-500",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  interview_scheduled: "Interview",
  accepted: "Accepted",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
};

/** "under_review" -> "Under Review"; leaves non-snake_case text untouched. */
export function humanizeStatus(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
