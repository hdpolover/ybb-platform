import { roundToNearest, convertUsdToIdr, convertIdrToUsd } from './money';

describe('money utilities', () => {
  describe('roundToNearest', () => {
    it('rounds 263775 to nearest 1000 → 264000', () => {
      expect(roundToNearest(263775, 1000)).toBe(264000);
    });
    it('rounds 263400 to nearest 1000 → 263000', () => {
      expect(roundToNearest(263400, 1000)).toBe(263000);
    });
    it('rounds half up at exact midpoint', () => {
      expect(roundToNearest(263500, 1000)).toBe(264000);
    });
    it('handles step of 1 (no rounding)', () => {
      expect(roundToNearest(123.456, 1)).toBe(123);
    });
  });

  describe('convertUsdToIdr', () => {
    it('multiplies and rounds to nearest 1000 by default', () => {
      expect(convertUsdToIdr(15, 17585)).toBe(264000);
    });
    it('respects custom rounding step', () => {
      expect(convertUsdToIdr(15, 17585, 100)).toBe(263800);
    });
  });

  describe('convertIdrToUsd', () => {
    it('divides and rounds to 2 decimals', () => {
      expect(convertIdrToUsd(263775, 17585)).toBeCloseTo(15.0, 2);
    });
  });
});
