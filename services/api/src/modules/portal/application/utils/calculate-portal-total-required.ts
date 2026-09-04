// src/modules/portal/application/utils/calculate-portal-total-required.ts

/**
 * Computes the dashboard "Total Required" amount.
 *
 * Two contributions:
 *  1. Existing `unpaid`/`failed` ApplicationInvoice rows (the historical behavior).
 *  2. The registration fee when it is *owed but not yet invoiced*.
 *
 * (2) is the important part: invoices are minted lazily (only when the
 * participant opens the Payments page and clicks a fee), so a freshly-registered
 * participant has no invoice yet. Summing invoices alone reports `$0.00` and
 * suppresses the "Payment Required" alert, even though the participant must pay
 * the registration fee before they can submit. Surfacing the applicable, in-window
 * registration tier here closes that gap.
 *
 * Scope is intentionally limited to the registration fee. Program-fee installments
 * are also lazily invoiced, but they only apply post-submission and are a separate
 * (lower-impact) case; generalizing to the full sequential-reveal lives in
 * `get-portal-payments.handler.ts` and is left out here to keep the blast radius small.
 */

import { effectiveStart, resolveTierPeriod } from '@shared/utils/tier-period.util';

type TotalRequiredInvoice = {
    status: string;
    amount: unknown;
    pricingTier?: { feeType?: string | null } | null;
};

type ValidityPeriod = { startDate: Date; endDate: Date };

type RegistrationTier = {
    allowedCategories: string[];
    validityPeriods?: ValidityPeriod[] | null;
    price: unknown;
    currency: string;
    usdPrice: unknown;
    idrPrice: unknown;
};

const REQUIRED_INVOICE_STATUSES = new Set(['unpaid', 'failed']);
// A registration fee is considered handled (no further amount owed now) when an
// invoice for it is already paid or in-flight.
const SETTLED_OR_INFLIGHT_STATUSES = new Set(['paid', 'processing']);

function toFiniteAmount(value: unknown): number {
    const parsed = Number(value ?? NaN);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function hasWindowStarted(periods: ValidityPeriod[] | null | undefined, now: Date): boolean {
    const list = periods ?? [];
    if (list.length === 0) {
        // No configured window means "available immediately".
        return true;
    }
    const period = resolveTierPeriod(list, now, now);
    if (!period) return true;
    // effectiveStart, not period.startDate. resolveTierPeriod already matched
    // this period through the widened start, so asking the raw one here can
    // contradict the selection that produced it: a window stored at 23:59 WIB
    // on its opening day is selected as current and then reported as not yet
    // started, zeroing totalRequired on the same dashboard payload that says
    // the window is open. Audit M66.
    return effectiveStart(period, list) <= now;
}

function resolveTierAmount(tier: RegistrationTier, currency: string): number {
    const normalized = currency.toUpperCase();
    if (normalized === 'USD' && tier.usdPrice !== null && tier.usdPrice !== undefined) {
        return toFiniteAmount(tier.usdPrice);
    }
    if (normalized === 'IDR' && tier.idrPrice !== null && tier.idrPrice !== undefined) {
        return toFiniteAmount(tier.idrPrice);
    }
    return toFiniteAmount(tier.price);
}

function isTierApplicable(tier: RegistrationTier, category: string | null): boolean {
    if (!category || tier.allowedCategories.length === 0) {
        return true;
    }
    return tier.allowedCategories.includes(category);
}

export function calculatePortalTotalRequired(
    category: string | null,
    invoices: TotalRequiredInvoice[],
    // Registration-fee tiers only (the caller scopes the query to feeType = 'registration_fee').
    registrationTiers: RegistrationTier[],
    programCurrency: string | null | undefined,
    now: Date,
): { amount: number; currency: string; hasOutstanding: boolean } {
    const currency = String(programCurrency || 'USD').toUpperCase();

    // (1) Existing unpaid/failed invoices — unchanged historical behavior.
    const invoiceTotal = invoices
        .filter((invoice) => REQUIRED_INVOICE_STATUSES.has(String(invoice.status).toLowerCase()))
        .reduce((sum, invoice) => sum + toFiniteAmount(invoice.amount), 0);

    // (2) Registration fee owed but not yet invoiced.
    const registrationInvoices = invoices.filter(
        (invoice) => invoice.pricingTier?.feeType === 'registration_fee',
    );
    const alreadyHasRegistrationInvoice = registrationInvoices.some((invoice) => {
        const status = String(invoice.status).toLowerCase();
        // Any existing reg-fee invoice means we do not add the tier amount:
        // - paid/processing: nothing (more) owed
        // - unpaid/failed: already counted in invoiceTotal above (no double count)
        return SETTLED_OR_INFLIGHT_STATUSES.has(status) || REQUIRED_INVOICE_STATUSES.has(status);
    });

    let uninvoicedRegistrationFee = 0;
    if (!alreadyHasRegistrationInvoice) {
        const applicableTier = registrationTiers.find((tier) => isTierApplicable(tier, category));
        if (applicableTier && hasWindowStarted(applicableTier.validityPeriods, now)) {
            uninvoicedRegistrationFee = resolveTierAmount(applicableTier, currency);
        }
    }

    const amount = Math.round((invoiceTotal + uninvoicedRegistrationFee) * 100) / 100;

    return {
        amount,
        currency,
        hasOutstanding: amount > 0,
    };
}
