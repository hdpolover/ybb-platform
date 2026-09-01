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
 * midnight) instead of end of day Jakarta. The end boundary is always
 * normalized to WIB end-of-day.
 *
 * The start boundary is left exactly as entered EXCEPT for a tier's
 * chronologically-earliest period, which is the one that gates "is
 * registration open" for the whole tier. 2026-09-01 incident: admins pick a
 * whole calendar day for that first period too, but it was being stored at
 * 23:59 WIB (the same end-of-day convention used for `endDate`), so a window
 * advertised as opening on a given date actually opened one minute before
 * midnight — Middle East Youth Summit 7th read as "Closed" all day it opened.
 * Widening every period's start this way would be wrong: chained periods
 * intentionally hand over at an exact instant (installment 2 starts exactly
 * when installment 1 ends, frequently 23:59 WIB) and normalizing those to
 * midnight would create ~280 extra overlapping period pairs — i.e. two
 * prices valid simultaneously, charging participants the wrong installment.
 * Restricting the widening to the single earliest period avoids that.
 */
import { endOfWibDay, startOfWibDay } from './wib-time';

export type TierValidityPeriod = { startDate: Date; endDate: Date };

/** The effective start of `period` used for open/closed comparisons. */
function effectiveStart(period: TierValidityPeriod, allPeriods: readonly TierValidityPeriod[]): Date {
    const isEarliest = allPeriods.every((other) => period.startDate <= other.startDate);
    return isEarliest ? startOfWibDay(period.startDate) : period.startDate;
}

/** Whether `date` falls within `period`, end boundary inclusive through WIB end-of-day. */
function isWithinPeriod(period: TierValidityPeriod, date: Date, allPeriods: readonly TierValidityPeriod[]): boolean {
    return effectiveStart(period, allPeriods) <= date && date <= endOfWibDay(period.endDate);
}

/** Whether `period` has already ended as of `now` (WIB end-of-day inclusive). */
export function hasTierPeriodEnded(period: TierValidityPeriod, now: Date): boolean {
    return endOfWibDay(period.endDate) < now;
}

/**
 * Write-time counterpart to the earliest-period widening above: if
 * `candidateStart` would make this the tier's earliest period once saved
 * (i.e. no sibling starts before it), pin it to WIB start-of-day so a stray
 * end-of-day entry can't reproduce the 2026-09-01 MEYS incident even before
 * the read-time safety net kicks in. `siblingStarts` must exclude the period
 * being written to itself (a create has no self to exclude; an update should
 * filter its own id out first). Left untouched otherwise — chained periods
 * intentionally start at an exact instant.
 */
export function snapEarliestPeriodStart(candidateStart: Date, siblingStarts: readonly Date[]): Date {
    const isEarliest = siblingStarts.every((siblingStart) => candidateStart <= siblingStart);
    return isEarliest ? startOfWibDay(candidateStart) : candidateStart;
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
    const byReference = periods.find((period) => isWithinPeriod(period, referenceDate, periods));
    const activeOrUpcoming = periods.find((period) => !hasTierPeriodEnded(period, now));
    const fallbackLatest = periods.length > 0 ? periods[periods.length - 1] : undefined;
    return byReference ?? activeOrUpcoming ?? fallbackLatest;
}
