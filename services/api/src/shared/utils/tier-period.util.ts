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

/**
 * Lifecycle phase of ONE application category's registration window.
 *
 *  - 'open':         some registration_fee tier allowing the category has a
 *                    window containing `now`
 *  - 'upcoming':     none is open, but at least one window starts later
 *  - 'closed':       every window for the category has ended
 *  - 'unconfigured': no active registration_fee tier allows the category at
 *                    all. This is NOT closure: programmes that never set up
 *                    per-category pricing must keep working exactly as before,
 *                    so callers treat it as "no category-level gate".
 */
export type CategoryRegistrationPhase = 'open' | 'upcoming' | 'closed' | 'unconfigured';

/**
 * The tier fields the category phase reads. `isActive`/`deletedAt`/`feeType`
 * are optional because several callers already scope their Prisma query to
 * active, non-deleted registration_fee tiers and do not select them again; an
 * absent field is read as "the query already filtered on it".
 */
export type CategoryPhaseTier = {
    feeType?: string | null;
    isActive?: boolean | null;
    deletedAt?: Date | null;
    allowedCategories?: readonly string[] | null;
    validityPeriods?: readonly TierValidityPeriod[] | null;
};

/**
 * The programme-level registration dates, used ONLY for a tier that carries no
 * validity periods of its own. Null on either side means unbounded on that
 * side, matching isProgramRegistrationOpen.
 */
export type ProgramRegistrationDates = {
    registrationOpenDate?: Date | null;
    registrationCloseDate?: Date | null;
};

type PhaseWindow = { start: number; end: number };

function programWindow(dates: ProgramRegistrationDates | undefined): PhaseWindow {
    // No programme dates supplied at all: the caller has asked for the tier
    // windows only, and a tier with none is not a closed tier. This is the
    // long-standing reading of the switch-category guard and the dashboard
    // flag, which never consulted programme dates.
    const open = dates?.registrationOpenDate ?? null;
    const close = dates?.registrationCloseDate ?? null;
    return {
        start: open ? startOfWibDay(open).getTime() : -Infinity,
        end: close ? endOfWibDay(close).getTime() : Infinity,
    };
}

function tierWindows(tier: CategoryPhaseTier, programDates: ProgramRegistrationDates | undefined): PhaseWindow[] {
    const periods = tier.validityPeriods ?? [];
    if (periods.length === 0) {
        // Mirrors ybb-program-next lib/registration/isRegistrationOpen.ts
        // getTierWindows: a tier without windows is governed by the programme's
        // registration dates. Deliberately NOT applied when the tier's windows
        // have all lapsed - that tier really did close.
        return [programWindow(programDates)];
    }
    return periods.map((period) => ({
        start: effectiveStart(period, periods).getTime(),
        end: endOfWibDay(period.endDate).getTime(),
    }));
}

/**
 * Single server-side answer to "may someone register/pay under `category`
 * right now", derived from the registration_fee pricing tiers.
 *
 * Why this exists: the pricing tier's validity periods ARE the per-category
 * registration deadline (admins set the Fully Funded and Self Funded windows
 * by editing each tier's periods). The programme's own registrationCloseDate is
 * a single date for the whole edition and in practice tracks the LAST
 * category to close, so it cannot express "Fully Funded closed, Self Funded
 * still open". Signup and payment only checked that programme date, which is
 * how MEYS/CYS 2026 kept creating Fully Funded accounts and taking the Fully
 * Funded fee after that window ended. The switch-category guard and the
 * dashboard flag had their own copy of the rule; they now route through here.
 *
 * Window semantics are the ones resolveTierPeriod uses: start = effectiveStart
 * (WIB midnight unless exactly chained to a preceding period), end = WIB
 * end-of-day inclusive. A period whose effective start is after its end can
 * never be open; it reads as ended once its end passes, exactly as
 * hasTierPeriodEnded always did.
 *
 * `programDates`: pass the programme's registration dates to make a tier
 * without periods follow them (signup, payments). Omit to read such a tier as
 * open-ended (the historical switch/dashboard behaviour).
 *
 * Category matching is strict (`allowedCategories` must contain it), matching
 * the switch handler this replaced; a tier with an empty list gates nobody.
 */
export function getCategoryRegistrationPhase(
    tiers: readonly CategoryPhaseTier[] | null | undefined,
    category: string,
    now: Date,
    programDates?: ProgramRegistrationDates,
): CategoryRegistrationPhase {
    const categoryTiers = (tiers ?? []).filter(
        (tier) => Array.isArray(tier.allowedCategories) && tier.allowedCategories.includes(category),
    );
    return getTiersRegistrationPhase(categoryTiers, now, programDates);
}

/**
 * The same phase over an explicit set of tiers, with no category filter. Used
 * where the tier in question is already known (e.g. the one a participant is
 * trying to pay) rather than derived from a category. Inactive, deleted and
 * non-registration tiers are ignored exactly as above; none left is
 * 'unconfigured'.
 */
export function getTiersRegistrationPhase(
    tiers: readonly CategoryPhaseTier[] | null | undefined,
    now: Date,
    programDates?: ProgramRegistrationDates,
): CategoryRegistrationPhase {
    const registrationTiers = (tiers ?? []).filter(
        (tier) =>
            tier.isActive !== false &&
            !tier.deletedAt &&
            (tier.feeType === undefined || tier.feeType === 'registration_fee'),
    );
    if (registrationTiers.length === 0) {
        return 'unconfigured';
    }

    const nowMs = now.getTime();
    const windows = registrationTiers.flatMap((tier) => tierWindows(tier, programDates));
    if (windows.some((w) => w.start <= nowMs && nowMs <= w.end)) {
        return 'open';
    }
    if (windows.some((w) => w.end >= nowMs)) {
        // Not open and not ended: it starts later.
        return 'upcoming';
    }
    return 'closed';
}

/** Whether `phase` permits creating a new registration under the category or
 * minting/paying its registration fee. 'unconfigured' deliberately passes: no
 * tier, no category-level gate. */
export function isCategoryRegistrationAvailable(phase: CategoryRegistrationPhase): boolean {
    return phase === 'open' || phase === 'unconfigured';
}
