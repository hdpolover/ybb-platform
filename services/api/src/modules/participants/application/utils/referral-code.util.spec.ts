// src/modules/participants/application/utils/referral-code.util.spec.ts
import { normalizeReferralCode } from './referral-code.util';

describe('normalizeReferralCode', () => {
    it('uppercases lowercase input', () => {
        expect(normalizeReferralCode('uro19948')).toBe('URO19948');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeReferralCode('  URO19948 ')).toBe('URO19948');
    });

    it('handles mixed case and padding together', () => {
        expect(normalizeReferralCode(' Uro19948  ')).toBe('URO19948');
    });

    it('leaves an already-normal code untouched', () => {
        expect(normalizeReferralCode('URO19948')).toBe('URO19948');
    });

    it('returns an empty string for null, undefined, or blank input', () => {
        expect(normalizeReferralCode(null)).toBe('');
        expect(normalizeReferralCode(undefined)).toBe('');
        expect(normalizeReferralCode('   ')).toBe('');
    });
});
