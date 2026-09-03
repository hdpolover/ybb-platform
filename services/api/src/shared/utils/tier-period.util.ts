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
 * The start boundary is left exactly as entered EXCEPT where widening it to
 * WIB midnight cannot overlap a preceding period. 2026-09-01 incident: admins
 * pick a whole calendar day for a period's start, but it was being stored at
 * 23:59 WIB (the same end-of-day convention used for `endDate`), so a window
 * advertised as opening on a given date actually opened one minute before
 * midnight — Middle East Youth Summit 7th read as "Closed" all day it opened.
 *
 * Widening every start unconditionally would be wrong: chained periods
 * intentionally hand over at an exact instant (installment 2 starts exactly
 * when installment 1 ends, frequently 23:59 WIB) and normalizing those to
 * midnight would create ~280 extra overlapping period pairs — two prices valid
 * simultaneously, charging participants the wrong installment.
 *
 * This used to be restricted to the tier's chronologically-earliest period,
 * which is safe but too narrow: it keys on POSITION IN THE ARRAY rather than on
 * the property that actually distinguishes a batch handover from a genuine gap.
 * An unchained later period — batch 2 opening some days after batch 1 closed —
 * has no preceding period to overlap and was still being read at 23:59 WIB, so
 * it read as closed for the whole first day exactly like MEYS 7th did.
 *
 * The rule is therefore the overlap test itself: widen to WIB midnight unless a
 * period that starts earlier is still open at that moment. That subsumes the
 * earliest-period case (nothing precedes it), leaves exactly-chained handovers
 * untouched (the preceding period is still open at midnight), and refuses to
 * widen a same-day handover that is not exactly chained. It also matches what
 * the frontend now does, so the two sides agree again.
 */
import { endOfWibDay, startOfWibDay } from './wib-time';

export type TierValidityPeriod = { startDate: Date; endDate: Date };

/** The effective start of `period` used for open/closed comparisons.
 *
 * Exported for testing. resolveTierPeriod's activeOrUpcoming fallback masks
 * differences in this rule - it picks the same period whether or not the start
 * was widened - so a test that only goes through resolveTierPeriod cannot tell
 * the widening rule from its predecessor. This is the boundary that carries the
 * incident history, so it is asserted directly. */
export function effectiveStart(period: TierValidityPeriod, allPeriods: readonly TierValidityPeriod[]): Date {
    const widened = startOfWibDay(period.startDate);

    // Never widen back into a period that is still open at the widened instant.
    // This is what keeps chained installments from both being valid at once.
    const wouldOverlapPreceding = allPeriods.some(
        (other) =>
            other !== period &&
            other.startDate < period.startDate &&
            endOfWibDay(other.endDate) >= widened,
    );

    return wouldOverlapPreceding ? period.startDate : widened;
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
