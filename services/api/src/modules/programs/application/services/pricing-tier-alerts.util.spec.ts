// services/api/src/modules/programs/application/services/pricing-tier-alerts.util.spec.ts
import { detectPricingTierAlerts } from './pricing-tier-alerts.util';

const NOW = new Date('2026-08-30T04:00:00.000Z'); // 11:00 WIB, 30 Aug 2026

function tier(id: string, name: string, periods: Array<{ start: string; end: string }>) {
    return {
        id,
        name,
        validityPeriods: periods.map((p) => ({ startDate: new Date(p.start), endDate: new Date(p.end) })),
    };
}

describe('detectPricingTierAlerts', () => {
    it('flags a lapsed tier: opened, but no period covers now', () => {
        const tiers = [tier('t1', 'Registration Fee (Fully Funded)', [{ start: '2026-08-01', end: '2026-08-20' }])];
        const { lapsed, expiring } = detectPricingTierAlerts(tiers, null, NOW);
        expect(lapsed).toEqual([
            { tierId: 't1', tierName: 'Registration Fee (Fully Funded)', sinceDate: new Date('2026-08-20T17:00:00.000Z') },
        ]);
        expect(expiring).toEqual([]);
    });

    it('does not flag a tier currently covered by a period', () => {
        const tiers = [tier('t1', 'Regular', [{ start: '2026-08-25', end: '2026-09-05' }])];
        const { lapsed, expiring } = detectPricingTierAlerts(tiers, null, NOW);
        expect(lapsed).toEqual([]);
        expect(expiring).toEqual([]);
    });

    it('does not flag a tier whose windows are entirely in the future (not open yet)', () => {
        const tiers = [tier('t1', 'Early Bird', [{ start: '2026-09-01', end: '2026-09-10' }])];
        const { lapsed, expiring } = detectPricingTierAlerts(tiers, null, NOW);
        expect(lapsed).toEqual([]);
        expect(expiring).toEqual([]);
    });

    it('flags coverage ending before registration_close_date as expiring, with the gap', () => {
        const tiers = [tier('t1', 'Regular', [{ start: '2026-08-25', end: '2026-09-01' }])];
        const registrationCloseDate = new Date('2026-11-02T17:00:00.000Z'); // end of 2 Nov WIB
        const { lapsed, expiring } = detectPricingTierAlerts(tiers, registrationCloseDate, NOW);
        expect(lapsed).toEqual([]);
        expect(expiring).toEqual([
            {
                tierId: 't1',
                tierName: 'Regular',
                coverageEndDate: new Date('2026-09-01T16:59:59.999Z'),
                registrationCloseDate,
                gapDays: 63,
            },
        ]);
    });

    it('skips the expiring check when registration_close_date is NULL', () => {
        const tiers = [tier('t1', 'Regular', [{ start: '2026-08-25', end: '2026-09-01' }])];
        const { lapsed, expiring } = detectPricingTierAlerts(tiers, null, NOW);
        expect(lapsed).toEqual([]);
        expect(expiring).toEqual([]);
    });

    it('skips tiers with no validity periods configured', () => {
        const tiers = [tier('t1', 'No Periods', [])];
        const { lapsed, expiring } = detectPricingTierAlerts(tiers, new Date('2026-11-02'), NOW);
        expect(lapsed).toEqual([]);
        expect(expiring).toEqual([]);
    });

    // ---- M66 / N16: the START edge uses the same WIB widening as the end ----
    // The end boundary already went through hasTierPeriodEnded; the start was
    // still raw. Admins pick a whole calendar day, and a start stored at the
    // end-of-day convention (23:59 WIB) therefore read as "not open yet" for
    // the entire day the window opened - the 2026-09-01 MEYS 7th shape. For an
    // alerting util that means the lapsed-coverage alert is suppressed on
    // exactly the day an admin most needs it.
    it('sees a window stored at 23:59 WIB on its start day as already open that day', () => {
        // The discriminating case, and the only shape where the start edge can
        // change an outcome. A tier is skipped entirely when NO period has
        // opened, so on the opening day the raw start produced NO alert at all
        // - not lapsed, not expiring - and the coverage gap stayed invisible
        // for the whole day. Widening the start to WIB midnight opens it, the
        // tier then covers now, and the expiring check can finally run.
        //
        // (The start edge cannot change a LAPSED verdict: anything that has
        // already ended is necessarily past its raw start too.)
        const tiers = [
            {
                id: 't1',
                name: 'Regular',
                validityPeriods: [
                    {
                        startDate: new Date('2026-08-30T16:59:00.000Z'), // 23:59 WIB, 30 Aug - today
                        endDate: new Date('2026-09-01T00:00:00.000Z'),
                    },
                ],
            },
        ];
        const registrationCloseDate = new Date('2026-11-02T17:00:00.000Z');

        const { lapsed, expiring } = detectPricingTierAlerts(tiers, registrationCloseDate, NOW);

        expect(lapsed).toEqual([]);
        expect(expiring).toEqual([
            {
                tierId: 't1',
                tierName: 'Regular',
                coverageEndDate: new Date('2026-09-01T16:59:59.999Z'),
                registrationCloseDate,
                gapDays: 63,
            },
        ]);
    });

    it('still refuses to widen a start that would overlap a preceding open period', () => {
        // The chained-installment exception the shared rule exists to protect:
        // period 2 starts exactly when period 1 ends, so widening its start to
        // WIB midnight would make both valid at once. It must stay raw, which
        // means it is NOT open at 11:00 WIB and the tier is not yet lapsed.
        const tiers = [
            {
                id: 't1',
                name: 'Installments',
                validityPeriods: [
                    {
                        startDate: new Date('2026-08-20T00:00:00.000Z'),
                        endDate: new Date('2026-08-30T16:59:00.000Z'), // 23:59 WIB, 30 Aug
                    },
                    {
                        startDate: new Date('2026-08-30T16:59:00.000Z'), // hands over at that instant
                        endDate: new Date('2026-09-10T00:00:00.000Z'),
                    },
                ],
            },
        ];

        const { lapsed } = detectPricingTierAlerts(tiers, null, NOW);

        expect(lapsed).toEqual([]);
    });
});
