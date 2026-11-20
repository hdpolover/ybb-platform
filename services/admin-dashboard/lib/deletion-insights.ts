// services/admin-dashboard/lib/deletion-insights.ts
// Types and labels for the platform "Account deletions" page (GET /admin/deletion-requests/insights).

export const DELETION_REASON_LABELS: Record<string, string> = {
  no_longer_interested: "No longer interested",
  not_accepted_or_cannot_attend: "Not accepted or cannot attend",
  too_many_emails: "Too many emails",
  privacy_concern: "Privacy concern",
  duplicate_account: "Duplicate account",
  cost: "Cost",
  bad_experience: "Bad experience",
  other: "Other",
  not_given: "Not given",
};

export const DELETION_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "approved", label: "Waiting for purge" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const DELETION_PAGE_SIZE = 20;

export type DeletionRequestItem = {
  id: string;
  status: string;
  /** null once the account is purged: shown as "Deleted user". */
  user: { name: string | null; email: string | null } | null;
  brand: string | null;
  reasonCategory: string | null;
  reason: string | null;
  createdAt: string;
  scheduledDeletionDate: string | null;
  actualDeletionDate: string | null;
};

export type DeletionInsights = {
  totals: {
    all: number;
    last30Days: number;
    pendingPurge: number;
    completed: number;
    cancelled: number;
    /** Fraction 0-1. */
    cancellationRate: number;
  };
  monthly: { month: string; count: number }[];
  byReason: { category: string; count: number }[];
  byBrand: { brandId: string | null; brand: string | null; count: number }[];
  requests: { items: DeletionRequestItem[]; page: number; limit: number; total: number; lastPage: number };
};

/** Unknown keys (legacy rows) fall back to a readable form of the raw key. */
export function reasonLabel(category: string | null | undefined): string {
  const key = category ?? "not_given";
  return DELETION_REASON_LABELS[key] ?? key.replace(/_/g, " ");
}

export function statusLabel(status: string): string {
  return status === "approved" ? "Waiting for purge" : status.charAt(0).toUpperCase() + status.slice(1);
}

const REASON_PREVIEW_CHARS = 60;

export function truncateReason(text: string | null | undefined): string {
  if (!text) return "—";
  return text.length > REASON_PREVIEW_CHARS ? `${text.slice(0, REASON_PREVIEW_CHARS - 1)}…` : text;
}

/** "2026-11" -> "Nov 26". */
export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export const formatPercent = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;
