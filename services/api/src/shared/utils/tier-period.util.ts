// src/shared/utils/tier-period.util.ts

/**
 * Single source of truth for "which pricing-tier validity period applies /
 * is it still open" — previously implemented three times with slightly
 * different interval rules (get-portal-payments.handler.ts,
 * calculate-portal-total-required.ts, switch-application-category.handler.ts),
 * which let the three call sites quietly disagree about whether a period
 * ending "today" was still open.
 *
 * Admins pick whole calendar days for a period's start/end, so comparing the
 * raw `endDate` against `new Date()` closed a period at 07:00 WIB (UTC
 * midnight) instead of end of day Jakarta. The end boundary is normalized to
 * WIB end-of-day; the start boundary is left exactly as entered (widening it
 * would open windows early, which is not the bug being fixed).
 */
import { endOfWibDay } from './wib-time';

export type TierValidityPeriod = { startDate: Date; endDate: Date };

/** Whether `date` falls within `period`, end boundary inclusive through WIB end-of-day. */
function isWithinPeriod(period: TierValidityPeriod, date: Date): boolean {
    return period.startDate <= date && date <= endOfWibDay(period.endDate);
}

/** Whether `period` has already ended as of `now` (WIB end-of-day inclusive). */
export function hasTierPeriodEnded(period: TierValidityPeriod, now: Date): boolean {
    return endOfWibDay(period.endDate) < now;
}

/**
 * Picks the validity period that governs a price/eligibility decision:
 *  1. the period containing `referenceDate` (inclusive both ends)
 *  2. else the first period that hasn't ended yet (active or upcoming)
 *  3. else the last configured period
 *
 * Pass `referenceDate = invoice.createdAt ?? now` when resolving a price so
 * an existing invoice keeps the window it was created in; pass `now` for
 * both arguments when checking current availability.
 */
export function resolveTierPeriod<T extends TierValidityPeriod>(
    periods: T[],
    referenceDate: Date,
    now: Date,
): T | undefined {
    const byReference = periods.find((period) => isWithinPeriod(period, referenceDate));
    const activeOrUpcoming = periods.find((period) => !hasTierPeriodEnded(period, now));
    const fallbackLatest = periods.length > 0 ? periods[periods.length - 1] : undefined;
    return byReference ?? activeOrUpcoming ?? fallbackLatest;
}
