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
