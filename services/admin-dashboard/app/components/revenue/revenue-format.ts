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
