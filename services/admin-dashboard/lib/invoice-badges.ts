// services/admin-dashboard/lib/invoice-badges.ts
// Invoice status / follow-up colour maps and money formatting shared by the payments list and the participant Payments tab.
import type { InvoiceListItem, InvoiceStatus } from "@/src/shared/api-client";
import { humanizeStatus } from "@/lib/application-badges";

export const NEUTRAL_PILL_CLASS = "bg-zinc-50 text-zinc-600 border-zinc-200";

export const INVOICE_STATUS_CLASS: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
};

export const FOLLOW_UP_CLASS: Record<string, string> = {
  participant_cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  payment_cancelled_issue: "bg-rose-50 text-rose-700 border-rose-200",
  payment_failed: "bg-red-50 text-red-700 border-red-200",
  manual_proof_rejected: "bg-orange-50 text-orange-700 border-orange-200",
  // `all_problems` is a filter-only bucket (matches any problem status) — it
  // is never a real per-row `followUpStatus` value, so no pill style needed.
  payment_processing_stuck: "bg-amber-50 text-amber-700 border-amber-200",
};

const FOLLOW_UP_LABELS: Record<string, string> = {
  payment_processing_stuck: "Processing (stuck)",
  all_problems: "All Problems",
};

export function formatFollowUpLabel(value: string): string {
  return FOLLOW_UP_LABELS[value] ?? humanizeStatus(value);
}

/** Whole-unit amount in the invoice currency, e.g. "IDR 264,000" / "$15". */
export function formatInvoiceAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface CurrencyTotal {
  currency: string;
  amount: number;
}

/** Sum of paid invoices per currency, in first-seen order; currencies with nothing paid are left out. */
export function paidTotalsByCurrency(invoices: Pick<InvoiceListItem, "status" | "amount" | "currency">[]): CurrencyTotal[] {
  const totals = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((acc, inv) => acc.set(inv.currency, (acc.get(inv.currency) ?? 0) + Number(inv.amount)), new Map<string, number>());
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}
