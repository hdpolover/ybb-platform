// services/api/src/modules/payments/infrastructure/services/gateway-transaction-status.util.ts

/**
 * Pure helpers for classifying a Go payment-service transaction/intent payload's
 * status. Shared by PaymentGatewayClient (cascade void), PaymentReconciliationService
 * (terminal-drift scan) and the orphaned-cancellation backfill script, so the
 * "never void a settled transaction" rule lives in exactly one place.
 */
export function extractTopLevelStatus(payload: Record<string, unknown> | null | undefined): string {
    if (!payload) return '';
    return String(payload.status ?? '').toUpperCase();
}

export function isSettledStatus(status: string): boolean {
    return status === 'SUCCESS' || status === 'SUCCEEDED';
}

export function isTerminalNonSettledStatus(status: string): boolean {
    return status === 'FAILED' || status === 'VOID' || status === 'REJECTED' || status === 'CANCELED';
}

export function isAwaitingReviewStatus(status: string): boolean {
    return status.toUpperCase() === 'NEEDS_REVIEW';
}
