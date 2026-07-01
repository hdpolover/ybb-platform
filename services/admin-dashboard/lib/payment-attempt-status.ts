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

/**
 * Terminal attempt/transaction statuses: once an attempt lands here, it is a
 * closed historical fact and must never be relabeled, even if the invoice it
 * belongs to later goes terminal for a different reason.
 */
const TERMINAL_ATTEMPT_STATUSES = new Set(["SUCCESS", "FAILED", "VOID", "REJECTED"]);

/**
 * Per-attempt history row fallback. Unlike `resolveAttemptDisplayStatus` (which
 * governs the single "current state" badges for the invoice's latest
 * transaction), this governs each row in the "Payment Attempts" history list.
 * A history list must not relabel genuinely terminal historical attempts
 * (SUCCESS/FAILED/VOID/REJECTED) as the invoice's status — that would destroy
 * history. It should only override a row that is still "live" (PENDING,
 * NEEDS_REVIEW, missing, or any other non-terminal value) sitting under an
 * invoice that has since gone terminal, since a live attempt under a terminal
 * invoice is stale by definition.
 */
export function resolveAttemptRowDisplayStatus(
  attemptStatus: string | undefined,
  invoiceStatus: string,
): string | undefined {
  if (UI_TERMINAL_INVOICE_STATUSES.has(invoiceStatus) && !TERMINAL_ATTEMPT_STATUSES.has(attemptStatus ?? "")) {
    return invoiceStatus;
  }
  return attemptStatus;
}
