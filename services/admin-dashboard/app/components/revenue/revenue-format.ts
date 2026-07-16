// app/components/revenue/revenue-format.ts

export type CurrencyMode = "IDR" | "USD";

/**
 * Full-precision currency formatter (not the compact `lib/utils.ts` one) —
 * matches the payments page convention: locale is tied to the currency
 * itself (id-ID for IDR, en-US for USD), not the admin's browser locale.
 */
export function formatMoney(amount: number, currency: CurrencyMode): string {
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Renders null (not-yet-backfilled) fee/net figures as an em dash, distinct from a real 0. */
export function formatNullableIdr(amount: number | null): string {
  if (amount === null) return "—";
  return formatMoney(amount, "IDR");
}

/**
 * Known internal payment-method codes mapped to human-friendly "{method type} (gateway)"
 * labels. `midtrans_cc` is a legacy misnomer: the actual gateway behind it is Xendit, not
 * Midtrans, so it must not read as "Midtrans" in a finance view.
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  midtrans_cc: "Credit Card (Xendit)",
  manual_transfer: "Bank Transfer (Manual)",
  manual_paypal: "PayPal (Manual)",
  midtrans_gopay: "GoPay (Midtrans)",
};

/** Title-cases a raw code as a last-resort fallback (e.g. "vakif_bank_jh8zx6" -> "Vakif Bank Jh8zx6"). */
function prettifyPaymentMethodCode(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Resolves a raw payment-method code into a human-friendly label for revenue views.
 * Known codes use the explicit map above; anything else falls back to a prettified
 * version of the code so a bare internal code is never shown in the UI.
 */
export function formatPaymentMethodLabel(code: string | null | undefined): string {
  if (!code || code === "unknown") return "Unknown";
  return PAYMENT_METHOD_LABELS[code] ?? prettifyPaymentMethodCode(code);
}
