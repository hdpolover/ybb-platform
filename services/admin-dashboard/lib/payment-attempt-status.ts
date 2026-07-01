// services/admin-dashboard/lib/payment-attempt-status.ts

/**
 * Invoice statuses that must never show a stale "live" gateway attempt status
 * underneath them. Mirrors ApplicationInvoice's terminal set minus `paid` (a paid
 * invoice showing its settling transaction's real status is not contradictory).
 */
const UI_TERMINAL_INVOICE_STATUSES = new Set(["cancelled", "failed", "refunded"]);

export type UiTerminalInvoiceStatus = "cancelled" | "failed" | "refunded";

/**
 * Component 5 — UI defensive fallback. When the invoice is terminal in a way that
 * implies the attempt must also be terminal (cancelled/failed/refunded), the
 * attempt/transaction badge defers to the invoice status instead of a live gateway
 * status that may not have settled yet (or ever, absent Components 1-2). This
 * guarantees "Pending" can never render under "Cancelled", even during a transient
 * race before the backend cascade void completes.
 */
export function resolveAttemptDisplayStatus(
  invoiceStatus: string,
  txnStatus: string | undefined,
): string | undefined {
  if (UI_TERMINAL_INVOICE_STATUSES.has(invoiceStatus)) {
    return invoiceStatus;
  }
  return txnStatus;
}
