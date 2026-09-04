// src/modules/portal/application/utils/calculate-portal-total-required.spec.ts
import { calculatePortalTotalRequired } from './calculate-portal-total-required';

const openWindow = () => [
    { startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000) },
];
const futureWindow = () => [
    { startDate: new Date(Date.now() + 86400000), endDate: new Date(Date.now() + 2 * 86400000) },
];

const regTier = (overrides: Record<string, unknown> = {}) => ({
    allowedCategories: ['self_funded'],
    price: 15,
    currency: 'USD',
    usdPrice: 15,
    idrPrice: 274500,
    validityPeriods: openWindow(),
    ...overrides,
});

describe('calculatePortalTotalRequired', () => {
    const now = new Date();

    it('returns 0 with no invoices and no tiers', () => {
        expect(calculatePortalTotalRequired('self_funded', [], [], 'USD', now)).toEqual({
            amount: 0,
            currency: 'USD',
            hasOutstanding: false,
        });
    });

    it('sums only unpaid and failed invoices', () => {
        const invoices = [
            { status: 'paid', amount: 100 },
            { status: 'unpaid', amount: 200 },
            { status: 'failed', amount: 50.5 },
            { status: 'processing', amount: 300 },
        ];
        expect(calculatePortalTotalRequired('self_funded', invoices, [], 'IDR', now)).toEqual({
            amount: 250.5,
            currency: 'IDR',
            hasOutstanding: true,
        });
    });

    it('adds an in-window registration fee that has no invoice yet', () => {
        const result = calculatePortalTotalRequired('self_funded', [], [regTier()], 'USD', now);
        expect(result).toEqual({ amount: 15, currency: 'USD', hasOutstanding: true });
    });

    it('resolves the IDR price for an IDR program', () => {
        const result = calculatePortalTotalRequired('self_funded', [], [regTier()], 'IDR', now);
        expect(result).toEqual({ amount: 274500, currency: 'IDR', hasOutstanding: true });
    });

    it('falls back to legacy price when the currency-matched snapshot is missing', () => {
        const tier = regTier({ usdPrice: null, idrPrice: null, price: 12, currency: 'USD' });
        const result = calculatePortalTotalRequired('self_funded', [], [tier], 'USD', now);
        expect(result.amount).toBe(12);
    });

    it('skips a registration tier not applicable to the category', () => {
        const tier = regTier({ allowedCategories: ['fully_funded'] });
        const result = calculatePortalTotalRequired('self_funded', [], [tier], 'USD', now);
        expect(result).toEqual({ amount: 0, currency: 'USD', hasOutstanding: false });
    });

    it('treats an empty allowedCategories tier as applicable to everyone', () => {
        const tier = regTier({ allowedCategories: [] });
        const result = calculatePortalTotalRequired('self_funded', [], [tier], 'USD', now);
        expect(result.amount).toBe(15);
    });

    it('does not add the fee before the window opens', () => {
        const tier = regTier({ validityPeriods: futureWindow() });
        const result = calculatePortalTotalRequired('self_funded', [], [tier], 'USD', now);
        expect(result.amount).toBe(0);
    });

    it('treats a tier with no window as immediately available', () => {
        const tier = regTier({ validityPeriods: [] });
        const result = calculatePortalTotalRequired('self_funded', [], [tier], 'USD', now);
        expect(result.amount).toBe(15);
    });

    it('does not add the fee once a paid registration invoice exists', () => {
        const invoices = [{ status: 'paid', amount: 15, pricingTier: { feeType: 'registration_fee' } }];
        const result = calculatePortalTotalRequired('self_funded', invoices, [regTier()], 'USD', now);
        expect(result.amount).toBe(0);
    });

    it('does not double-count an existing unpaid registration invoice', () => {
        const invoices = [{ status: 'unpaid', amount: 15, pricingTier: { feeType: 'registration_fee' } }];
        const result = calculatePortalTotalRequired('self_funded', invoices, [regTier()], 'USD', now);
        expect(result.amount).toBe(15);
    });

    // ---- M66: the window START edge must match the selection that produced it ----
    // hasWindowStarted read `period.startDate` raw off a period that
    // resolveTierPeriod had already MATCHED through the widened start, so the
    // two could contradict each other. A window stored at 23:59 WIB on its
    // opening day was selected as the current period and then reported as not
    // yet started, zeroing totalRequired on the very same dashboard payload
    // that reports the window as open.
    it('counts the registration fee on a window stored at 23:59 WIB on its opening day', () => {
        const openingDay = new Date('2026-09-05T05:00:00.000Z'); // 12:00 WIB, 5 Sep
        const tier = regTier({
            validityPeriods: [
                {
                    startDate: new Date('2026-09-05T16:59:00.000Z'), // 23:59 WIB, 5 Sep - today
                    endDate: new Date('2026-09-20T00:00:00.000Z'),
                },
            ],
        });

        const result = calculatePortalTotalRequired('self_funded', [], [tier], 'USD', openingDay);

        expect(result).toEqual({ amount: 15, currency: 'USD', hasOutstanding: true });
    });

    it('still does not count a fee for a window that has genuinely not opened yet', () => {
        // Guard against over-widening: a window opening tomorrow stays unbilled.
        const openingDay = new Date('2026-09-05T05:00:00.000Z');
        const tier = regTier({
            validityPeriods: [
                {
                    startDate: new Date('2026-09-06T16:59:00.000Z'), // 23:59 WIB, 6 Sep - tomorrow
                    endDate: new Date('2026-09-20T00:00:00.000Z'),
                },
            ],
        });

        const result = calculatePortalTotalRequired('self_funded', [], [tier], 'USD', openingDay);

        expect(result).toEqual({ amount: 0, currency: 'USD', hasOutstanding: false });
    });
});
