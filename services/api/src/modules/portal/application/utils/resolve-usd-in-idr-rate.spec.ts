import { Prisma } from '@prisma/client';
import { resolveUsdInIdrRate } from './resolve-usd-in-idr-rate';

describe('resolveUsdInIdrRate', () => {
    it('reads a Prisma Decimal program rate', () => {
        expect(
            resolveUsdInIdrRate({
                programRate: new Prisma.Decimal('17580'),
            }),
        ).toBe(17580);
    });

    it('prefers a Decimal snapshot over the program rate', () => {
        expect(
            resolveUsdInIdrRate({
                snapshot: new Prisma.Decimal('17600'),
                programRate: new Prisma.Decimal('17580'),
            }),
        ).toBe(17600);
    });

    it('returns undefined when neither rate is usable', () => {
        expect(
            resolveUsdInIdrRate({
                snapshot: 0,
                programRate: null,
            }),
        ).toBeUndefined();
    });
});
