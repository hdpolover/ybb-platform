// src/shared/utils/tier-period.util.spec.ts
import { hasTierPeriodEnded, resolveTierPeriod, TierValidityPeriod } from './tier-period.util';

describe('tier-period.util', () => {
    const period = (startDate: string, endDate: string): TierValidityPeriod => ({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
    });

    describe('resolveTierPeriod', () => {
        it('picks the period containing referenceDate', () => {
            const periods = [
                period('2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z'),
                period('2026-02-01T00:00:00Z', '2026-02-28T00:00:00Z'),
            ];
            const referenceDate = new Date('2026-01-15T00:00:00Z');
            expect(resolveTierPeriod(periods, referenceDate, referenceDate)).toBe(periods[0]);
        });

        it('falls back to the first upcoming/active period when referenceDate matches none', () => {
            const periods = [
                period('2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z'), // lapsed
                period('2026-03-01T00:00:00Z', '2026-03-31T00:00:00Z'), // upcoming
            ];
            const now = new Date('2026-02-15T00:00:00Z');
            expect(resolveTierPeriod(periods, now, now)).toBe(periods[1]);
        });

        it('falls back to the last configured period when all have lapsed', () => {
            const periods = [
                period('2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z'),
                period('2026-01-11T00:00:00Z', '2026-01-20T00:00:00Z'),
            ];
            const now = new Date('2026-06-01T00:00:00Z');
            expect(resolveTierPeriod(periods, now, now)).toBe(periods[1]);
        });

        it('returns undefined for an empty period list', () => {
            expect(resolveTierPeriod([], new Date(), new Date())).toBeUndefined();
        });

        it('locks an invoice to the period active at invoice.createdAt even if now has moved on', () => {
            const periods = [
                period('2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z'),
                period('2026-02-01T00:00:00Z', '2026-02-28T00:00:00Z'),
            ];
            const invoiceCreatedAt = new Date('2026-01-15T00:00:00Z');
            const now = new Date('2026-02-15T00:00:00Z');
            expect(resolveTierPeriod(periods, invoiceCreatedAt, now)).toBe(periods[0]);
        });

        describe('WIB end-of-day boundary', () => {
            // A period whose endDate is "today" (UTC-midnight, as picked by an
            // admin) must stay open through 23:59:59.999 WIB, not close at
            // 07:00 WIB (UTC midnight) as raw `endDate >= now` would. A second,
            // later period makes the "no longer selected" assertion meaningful
            // (resolveTierPeriod always falls back to *some* period otherwise).
            const currentPeriod = period('2026-07-01T00:00:00Z', '2026-07-15T00:00:00Z');
            const futurePeriod = period('2026-08-01T00:00:00Z', '2026-08-15T00:00:00Z');
            const periods = [currentPeriod, futurePeriod];

            it('is still open at 08:00 WIB (01:00 UTC) on the end day', () => {
                const now = new Date('2026-07-15T01:00:00Z'); // 08:00 WIB
                expect(resolveTierPeriod(periods, now, now)).toBe(currentPeriod);
            });

            it('is still open at 23:00 WIB (16:00 UTC) on the end day', () => {
                const now = new Date('2026-07-15T16:00:00Z'); // 23:00 WIB
                expect(resolveTierPeriod(periods, now, now)).toBe(currentPeriod);
            });

            it('is closed the next WIB morning, so the next period takes over', () => {
                const now = new Date('2026-07-16T01:00:00Z'); // 08:00 WIB, next day
                expect(resolveTierPeriod(periods, now, now)).toBe(futurePeriod);
            });
        });
    });

    describe('hasTierPeriodEnded', () => {
        const p = period('2026-07-01T00:00:00Z', '2026-07-15T00:00:00Z');

        it('is false at 08:00 WIB on the end day', () => {
            expect(hasTierPeriodEnded(p, new Date('2026-07-15T01:00:00Z'))).toBe(false);
        });

        it('is false at 23:00 WIB on the end day', () => {
            expect(hasTierPeriodEnded(p, new Date('2026-07-15T16:00:00Z'))).toBe(false);
        });

        it('is true the next WIB morning', () => {
            expect(hasTierPeriodEnded(p, new Date('2026-07-16T01:00:00Z'))).toBe(true);
        });
    });
});
