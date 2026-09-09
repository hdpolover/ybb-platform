// services/api/src/modules/programs/application/services/pricing-tier-alerts.util.ts

/**
 * Detects the "silent lapse" defect that took China Youth Summit 2026's
 * fully-funded category offline for nine days (21-30 Aug 2026): admins
 * extend a tier's purchase window by appending one-off validity periods,
 * and when the chain of appends just stops, the tier goes invisible to
 * participants with no signal anywhere. Middle East Youth Summit 6th was a
 * day from the same fate.
 *
 * Reuses the canonical interval rules from tier-period.util.ts (WIB
 * end-of-day inclusive) rather than re-deriving "is this period open" a
 * fourth time.
 */
import { addDays, endOfWibDay, startOfWibDay } from '../../../../shared/utils/wib-time';
import { effectiveStart, hasTierPeriodEnded, TierValidityPeriod } from '../../../../shared/utils/tier-period.util';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PricingTierAlertInput = {
    id: string;
    name: string;
    validityPeriods: TierValidityPeriod[];
};

export type LapsedTierAlert = { tierId: string; tierName: string; sinceDate: Date };
export type ExpiringTierAlert = {
    tierId: string;
    tierName: string;
    coverageEndDate: Date;
    registrationCloseDate: Date;
    gapDays: number;
};

export type PricingTierAlerts = { lapsed: LapsedTierAlert[]; expiring: ExpiringTierAlert[] };

/**
 * The two ApplicationCategory enum values, duplicated here (rather than
 * imported from @prisma/client) so this pure detection util stays free of a
 * Prisma dependency - see PricingTierAlertInput for the same reasoning.
 * Matches isAllowedForCategory's convention in category-scope.util.ts: an
 * empty allowedCategories array means "applies to every category".
 */
const ALL_APPLICATION_CATEGORIES = ['fully_funded', 'self_funded'] as const;

export type CoverageTierInput = {
    id: string;
    name: string;
    isActive: boolean;
    feeType: string;
    allowedCategories: string[];
    validityPeriods: TierValidityPeriod[];
};

export type UncoveredCategoryAlert = {
    category: string;
    tierId: string;
    tierName: string;
};

const expandCategories = (allowed: string[]): readonly string[] =>
    allowed.length === 0 ? ALL_APPLICATION_CATEGORIES : allowed;

const tierCoversNow = (tier: CoverageTierInput, now: Date): boolean => {
    if (!tier.isActive) return false;
    const periods = tier.validityPeriods;
    if (periods.length === 0) return false;
    return periods.some((p) => effectiveStart(p, periods) <= now && !hasTierPeriodEnded(p, now));
};

/**
 * The MEYS 6th incident (2026-09-08): an admin deactivated
 * `Registration Fee (Fully Funded)`, the only registration_fee tier allowing
 * the fully_funded category. detectPricingTierAlerts above never saw it -
 * its caller only fetches isActive tiers in the first place, so a
 * deactivated tier is simply absent from the array, not a "lapsed" entry.
 * And when deactivation empties a program down to zero *active* tiers, the
 * old scan short-circuited on `pricingTiers.length === 0` and emitted
 * nothing at all.
 *
 * This checks the thing that actually matters instead of any one failure
 * mode of it: does every participation category this program's
 * registration_fee tiers were ever configured for still have a tier that is
 * active, not soft-deleted (deletedAt: null is enforced by the caller's
 * query, same as everywhere else in this codebase), and covers `now`. That
 * single condition catches deactivation (this incident), a lapsed validity
 * period with no active tier picking up the category (the China Youth
 * Summit incident this whole module exists for), and a misconfigured
 * allowedCategories that silently drops a category from every active tier.
 *
 * `tiers` must include INACTIVE registration_fee tiers too (not just active
 * ones) - that is what lets "configured for" be answered at all; a program
 * with only an active tier and nothing else correctly reports zero
 * candidates to be missing.
 *
 * A program with zero registration_fee tiers ever configured produces zero
 * alerts here (configuredCategories stays empty) - that is the "genuinely
 * no categories configured" case, and it must not be indistinguishable from
 * a real defect.
 */
export function detectUncoveredCategories(tiers: CoverageTierInput[], now: Date): UncoveredCategoryAlert[] {
    const registrationTiers = tiers.filter((t) => t.feeType === 'registration_fee');

    const configuredCategories = new Set<string>();
    for (const tier of registrationTiers) {
        for (const category of expandCategories(tier.allowedCategories)) {
            configuredCategories.add(category);
        }
    }

    const alerts: UncoveredCategoryAlert[] = [];
    for (const category of configuredCategories) {
        const matchingTiers = registrationTiers.filter((t) => expandCategories(t.allowedCategories).includes(category));
        if (matchingTiers.some((t) => tierCoversNow(t, now))) continue;

        // matchingTiers is never empty here: `category` only entered the set
        // by coming off one of these tiers' own (expanded) allowedCategories.
        const candidate = matchingTiers[0];
        alerts.push({ category, tierId: candidate.id, tierName: candidate.name });
    }

    return alerts;
}

const maxPeriodEnd = (periods: TierValidityPeriod[]): Date =>
    periods.reduce(
        (latest, p) => (endOfWibDay(p.endDate) > latest ? endOfWibDay(p.endDate) : latest),
        endOfWibDay(periods[0].endDate),
    );

/**
 * (a) LAPSED: a tier that has opened (some period already started) but no
 * period currently covers `now` - the outage state.
 * (b) EXPIRING: a tier that covers `now`, but its last configured period
 * ends before the program's registration close date - the leading
 * indicator that (a) is coming.
 *
 * A tier whose periods are all in the future is skipped for both: that is
 * a program that has not opened yet, not a defect.
 */
export function detectPricingTierAlerts(
    tiers: PricingTierAlertInput[],
    registrationCloseDate: Date | null,
    now: Date,
): PricingTierAlerts {
    const lapsed: LapsedTierAlert[] = [];
    const expiring: ExpiringTierAlert[] = [];

    for (const tier of tiers) {
        const periods = tier.validityPeriods;
        if (periods.length === 0) continue;

        // Raw startDate read a window stored at 23:59 WIB as "not open yet"
        // for its whole first day, which suppressed the lapsed-coverage
        // alert for exactly the day an admin most needs it. Same widening
        // rule the end boundary below already uses.
        const openedPeriods = periods.filter((p) => effectiveStart(p, periods) <= now);
        if (openedPeriods.length === 0) continue; // not open yet

        const coversNow = openedPeriods.some((p) => !hasTierPeriodEnded(p, now));
        if (!coversNow) {
            const sinceDate = addDays(startOfWibDay(maxPeriodEnd(openedPeriods)), 1);
            lapsed.push({ tierId: tier.id, tierName: tier.name, sinceDate });
            continue;
        }

        if (!registrationCloseDate) continue;
        const coverageEnd = maxPeriodEnd(periods);
        if (coverageEnd < registrationCloseDate) {
            const gapDays = Math.ceil((registrationCloseDate.getTime() - coverageEnd.getTime()) / MS_PER_DAY);
            expiring.push({ tierId: tier.id, tierName: tier.name, coverageEndDate: coverageEnd, registrationCloseDate, gapDays });
        }
    }

    return { lapsed, expiring };
}
