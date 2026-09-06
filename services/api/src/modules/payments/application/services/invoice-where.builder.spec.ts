// services/api/src/modules/payments/application/services/invoice-where.builder.spec.ts
//
// Audit M159. An admin date filter is a calendar day IN JAKARTA, because the
// admin dashboard renders every timestamp in WIB. Parsing "2026-08-31" with
// `new Date()` anchors it to UTC midnight and closes the range at UTC
// end-of-day, so the last SEVEN HOURS of the range belong to the next WIB day.
//
// Reported from production: filtering the payments list by paid date
// "31 Aug to 31 Aug" on Middle East Youth Summit 6th returned 100 invoices, 50
// of which the dashboard displayed as 1 Sept - they were paid between 00:03 and
// 06:10 WIB. The correct count for that WIB day is 55.
import { buildInvoiceWhere, endOfWibFilterDay } from './invoice-where.builder';

// 31 Aug 2026 in Jakarta runs from 30 Aug 17:00Z to 31 Aug 16:59:59.999Z.
const WIB_31_AUG_START = new Date('2026-08-30T17:00:00.000Z');
const WIB_31_AUG_END = new Date('2026-08-31T16:59:59.999Z');

// The row that made the bug visible: paid 31 Aug 23:10Z, which is 1 Sept 06:10
// in Jakarta and therefore NOT part of the 31 Aug filter.
const DISPLAYS_AS_1_SEPT = new Date('2026-08-31T23:10:00.000Z');

describe('endOfWibFilterDay', () => {
    it('closes a bare calendar day at WIB end-of-day, not UTC end-of-day', () => {
        expect(endOfWibFilterDay('2026-08-31')).toEqual(WIB_31_AUG_END);
    });

    it('excludes an instant that falls on the next WIB day', () => {
        expect(endOfWibFilterDay('2026-08-31').getTime()).toBeLessThan(DISPLAYS_AS_1_SEPT.getTime());
    });

    it('leaves a value that already carries a time or offset alone', () => {
        // Only a bare YYYY-MM-DD means "a calendar day". An explicit instant is
        // already absolute and must not be re-anchored.
        const explicit = '2026-08-31T10:00:00.000Z';
        expect(endOfWibFilterDay(explicit)).toEqual(new Date('2026-08-31T16:59:59.999Z'));
    });

    it('returns an invalid date unchanged rather than throwing', () => {
        expect(Number.isNaN(endOfWibFilterDay('not-a-date').getTime())).toBe(true);
    });
});

describe('buildInvoiceWhere paid-date range (audit M159)', () => {
    const paidRange = (from?: string, to?: string) =>
        (buildInvoiceWhere({ paidFrom: from, paidTo: to }, []) as { paidAt?: { gte?: Date; lte?: Date } }).paidAt;

    it('bounds a single-day paid filter to the WIB day, both ends', () => {
        expect(paidRange('2026-08-31', '2026-08-31')).toEqual({
            gte: WIB_31_AUG_START,
            lte: WIB_31_AUG_END,
        });
    });

    it('does not reach into the next WIB day, which is what the admin saw', () => {
        const range = paidRange('2026-08-31', '2026-08-31');

        // Under the old UTC bound this was 2026-08-31T23:59:59.999Z, which
        // swept in 50 payments the dashboard labelled 1 Sept.
        expect(range?.lte?.getTime()).toBeLessThan(DISPLAYS_AS_1_SEPT.getTime());
    });

    it('starts at WIB midnight, not UTC midnight', () => {
        // A UTC lower bound would have MISSED payments made between 00:00 and
        // 07:00 WIB on the first day of the range - the same seven hours, lost
        // off the other end.
        const range = paidRange('2026-08-31', '2026-08-31');
        expect(range?.gte).toEqual(WIB_31_AUG_START);
        expect(range?.gte?.getTime()).toBeLessThan(new Date('2026-08-31T00:00:00.000Z').getTime());
    });

    it('applies the same rule to the invoice-date range', () => {
        const where = buildInvoiceWhere({ dateFrom: '2026-08-31', dateTo: '2026-08-31' }, []) as {
            createdAt?: { gte?: Date; lte?: Date };
        };

        expect(where.createdAt).toEqual({ gte: WIB_31_AUG_START, lte: WIB_31_AUG_END });
    });

    it('leaves the range open when only one end is supplied', () => {
        expect(paidRange('2026-08-31', undefined)).toEqual({ gte: WIB_31_AUG_START });
        expect(paidRange(undefined, '2026-08-31')).toEqual({ lte: WIB_31_AUG_END });
    });
});
