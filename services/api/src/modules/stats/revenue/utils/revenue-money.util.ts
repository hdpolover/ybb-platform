// src/modules/stats/revenue/utils/revenue-money.util.ts
import { resolveUsdInIdrRate } from '../../../portal/application/utils/resolve-usd-in-idr-rate';

/** Minimal shape pulled off ApplicationInvoice needed to resolve gross/fee/net. */
export interface RevenueInvoiceMoneyInput {
  amount: unknown; // Prisma.Decimal
  currency: string;
  amountUsd: unknown | null;
  amountIdr: unknown | null;
  exchangeRateSnapshot: unknown | null;
  feeProvider: unknown | null;
  netAmount: unknown | null;
}

export interface ResolvedInvoiceMoney {
  /** Canonical IDR gross (settlement currency). Undefined only when the invoice is
   * USD-denominated, has no amountIdr snapshot, and no FX rate is resolvable. */
  grossIdr: number | undefined;
  /** USD-equivalent gross, for display. Same "undefined = unresolvable" rule as grossIdr. */
  grossUsd: number | undefined;
  /** Estimated provider fee, IDR. 0 when not yet backfilled (see isBackfilled). */
  feeIdr: number;
  /** Estimated net (gross - fee), IDR. Falls back to grossIdr when netAmount is NULL
   * (fee assumed 0) per the "prefer gross over guessed net" rule. */
  netIdr: number | undefined;
  /** Estimated net, USD. Derived from grossUsd/feeUsd using the same per-invoice rate. */
  netUsd: number | undefined;
  /** True only when BOTH feeProvider and netAmount are populated on the invoice
   * (i.e. this row has real backfilled/event-sourced fee data, not an assumption). */
  isBackfilled: boolean;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value === 'object' && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Resolves gross/fee/net figures for a single invoice.
 *
 * Money rules (see task spec for the full rationale):
 * - IDR is the canonical settlement currency (Xendit settles in IDR); fee_provider/net_amount
 *   are always IDR.
 * - Gross prefers the invoice's own dual-price snapshot (amountIdr/amountUsd, frozen at intent
 *   creation) over re-deriving via a rate — only falls back to rate-based conversion when the
 *   snapshot for that currency is missing.
 * - FX rate resolution NEVER hardcodes a constant: invoice.exchangeRateSnapshot first, then the
 *   program's configured usdInIdr, else the invoice is excluded from that currency's aggregation.
 * - When netAmount is NULL (not yet backfilled), net is estimated as gross (fee assumed 0) rather
 *   than guessed — isBackfilled=false signals to callers that this row's fee/net are unavailable.
 */
export function resolveInvoiceRevenue(
  invoice: RevenueInvoiceMoneyInput,
  programUsdInIdr: unknown,
): ResolvedInvoiceMoney {
  const rate = resolveUsdInIdrRate({
    snapshot: invoice.exchangeRateSnapshot,
    programRate: programUsdInIdr,
  });
  const isIdr = (invoice.currency ?? '').toUpperCase() === 'IDR';
  const rawAmount = toNumberOrUndefined(invoice.amount);

  const grossIdr =
    toNumberOrUndefined(invoice.amountIdr) ??
    (isIdr
      ? rawAmount
      : rate !== undefined && rawAmount !== undefined
        ? rawAmount * rate
        : undefined);

  const grossUsd =
    toNumberOrUndefined(invoice.amountUsd) ??
    (!isIdr
      ? rawAmount
      : rate !== undefined && rawAmount !== undefined
        ? rawAmount / rate
        : undefined);

  const isBackfilled = invoice.feeProvider !== null && invoice.netAmount !== null;
  const feeIdr = toNumberOrUndefined(invoice.feeProvider) ?? 0;
  const netIdr = invoice.netAmount !== null ? toNumberOrUndefined(invoice.netAmount) : grossIdr;

  const feeUsd = rate !== undefined ? feeIdr / rate : undefined;
  const netUsd = grossUsd !== undefined && feeUsd !== undefined ? grossUsd - feeUsd : undefined;

  return { grossIdr, grossUsd, feeIdr, netIdr, netUsd, isBackfilled };
}
