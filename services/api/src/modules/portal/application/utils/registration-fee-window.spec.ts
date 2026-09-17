// src/modules/portal/application/utils/registration-fee-window.spec.ts
import {
    getRegistrationFeeWindowRejection,
    isRegistrationFeeTierOffCategory,
    resolveRegistrationFeePhase,
} from './registration-fee-window';

describe('registration-fee-window', () => {
    const now = new Date('2026-09-17T05:00:00Z');
    const lapsed = [{ startDate: new Date('2026-07-01T00:00:00Z'), endDate: new Date('2026-09-05T00:00:00Z') }];
    const running = [{ startDate: new Date('2026-07-01T00:00:00Z'), endDate: new Date('2026-11-30T00:00:00Z') }];
    const future = [{ startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-11-30T00:00:00Z') }];

    const ff = (validityPeriods = lapsed) => ({ allowedCategories: ['fully_funded'], validityPeriods });
    const sf = (validityPeriods = running) => ({ allowedCategories: ['self_funded'], validityPeriods });

    describe('resolveRegistrationFeePhase', () => {
        it('uses the category phase when the category has tiers', () => {
            // Paying an open tier does not help when the category itself closed.
            expect(
                resolveRegistrationFeePhase({ category: 'fully_funded', tier: sf(), registrationTiers: [ff(), sf()], now }),
            ).toBe('closed');
        });

        it('falls back to the paid tier own window when the category has no tier', () => {
            expect(
                resolveRegistrationFeePhase({ category: 'fully_funded', tier: sf(), registrationTiers: [sf()], now }),
            ).toBe('open');
            expect(
                resolveRegistrationFeePhase({ category: 'fully_funded', tier: sf(lapsed), registrationTiers: [sf(lapsed)], now }),
            ).toBe('closed');
        });

        it('uses the tier own window without a category', () => {
            expect(resolveRegistrationFeePhase({ category: null, tier: ff(), registrationTiers: [ff(), sf()], now })).toBe('closed');
        });

        it('treats a tier without periods as payable (programme dates deliberately not consulted)', () => {
            const noPeriods = { allowedCategories: ['fully_funded'], validityPeriods: [] };
            expect(
                resolveRegistrationFeePhase({ category: 'fully_funded', tier: noPeriods, registrationTiers: [noPeriods], now }),
            ).toBe('open');
        });
    });

    describe('getRegistrationFeeWindowRejection', () => {
        it('is null while open', () => {
            expect(getRegistrationFeeWindowRejection({ category: 'self_funded', tier: sf(), registrationTiers: [ff(), sf()], now })).toBeNull();
        });

        it('returns REGISTRATION_WINDOW_CLOSED with a category-named message once closed', () => {
            expect(getRegistrationFeeWindowRejection({ category: 'fully_funded', tier: ff(), registrationTiers: [ff(), sf()], now })).toEqual({
                errorCode: 'REGISTRATION_WINDOW_CLOSED',
                message: 'Fully Funded registration has closed, so this registration fee can no longer be paid.',
            });
        });

        it('returns REGISTRATION_WINDOW_NOT_OPEN before it opens', () => {
            expect(
                getRegistrationFeeWindowRejection({ category: 'fully_funded', tier: ff(future), registrationTiers: [ff(future)], now }),
            ).toMatchObject({ errorCode: 'REGISTRATION_WINDOW_NOT_OPEN' });
        });
    });

    describe('isRegistrationFeeTierOffCategory', () => {
        it('flags another category tier when the participant category has its own', () => {
            expect(isRegistrationFeeTierOffCategory({ category: 'self_funded', tier: ff(), registrationTiers: [ff(), sf()], now })).toBe(true);
        });

        it('does not flag the participant own category tier', () => {
            expect(isRegistrationFeeTierOffCategory({ category: 'self_funded', tier: sf(), registrationTiers: [ff(), sf()], now })).toBe(false);
        });

        it('does not flag when the participant category has no tier (June 2026 deadlock rule)', () => {
            expect(isRegistrationFeeTierOffCategory({ category: 'self_funded', tier: ff(), registrationTiers: [ff()], now })).toBe(false);
        });

        it('does not flag an empty allowedCategories tier or a missing category', () => {
            const anyone = { allowedCategories: [], validityPeriods: running };
            expect(isRegistrationFeeTierOffCategory({ category: 'self_funded', tier: anyone, registrationTiers: [ff(), sf()], now })).toBe(false);
            expect(isRegistrationFeeTierOffCategory({ category: null, tier: ff(), registrationTiers: [ff(), sf()], now })).toBe(false);
        });
    });
});
