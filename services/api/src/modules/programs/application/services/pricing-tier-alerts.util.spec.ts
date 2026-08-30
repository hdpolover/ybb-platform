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
});
