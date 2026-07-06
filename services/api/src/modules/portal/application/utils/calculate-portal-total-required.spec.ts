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
});
