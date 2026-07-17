// src/modules/payments/application/utils/payment-method.util.ts
//
// Shared manual-payment-method predicate. Single source of truth so callers
// (PaymentAdminController's void-on-terminal-transition path, the terminal
// drift reconciliation scan) never drift apart on what counts as "manual".
//
// MUST mirror the Go CancelPayment guard exactly - that guard only lets a
// SUCCESS transaction be cancelled when PaymentMethodID == "manual_transfer"
// (the entities.PaymentMethodManualTransfer literal that SubmitManualPayment
// always writes). A broader substring match (e.g. includes('transfer')) would
// also catch the real Midtrans "bank_transfer"/VA method, wrongly skip the
// API-side DANGER settled-block for a genuinely captured gateway payment, then
// hit Go's 400 (which voidTransaction swallows as 'already_terminal') and let
// the local invoice drift to failed while the gateway stays SUCCESS (an actual
// un-enrolment of a paid participant). So keep this strict equality, not a
// substring match. Deliberately does NOT trust payment_transactions.is_manual,
// which has been observed false on a genuine manual transaction in prod.
export function isManualPaymentMethod(paymentMethod: string | null | undefined): boolean {
    return (paymentMethod || '').toLowerCase().trim() === 'manual_transfer';
}
