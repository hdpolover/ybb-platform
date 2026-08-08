// src/shared/utils/wib-time.spec.ts

import {
    addDays,
    addWibMonths,
    parseWibFilterDate,
    startOfWibDay,
    startOfWibMonth,
    startOfWibWeek,
    wibDateKey,
} from './wib-time';

describe('wib-time', () => {
    describe('startOfWibDay', () => {
        it('anchors to 17:00 UTC the previous day, which is WIB midnight', () => {
            expect(startOfWibDay(new Date('2026-07-15T10:00:00Z')).toISOString()).toBe(
                '2026-07-14T17:00:00.000Z',
            );
        });

        /**
         * The regression this whole module exists for. 02:00 WIB on 15/07 is
         * 19:00 UTC on 14/07, so UTC bucketing filed it under the 14th and the
         * dashboard's "today" read 0 for the first seven hours of every WIB day.
         */
        it('keeps early-morning WIB traffic on the WIB day it belongs to', () => {
            const earlyMorningWib = new Date('2026-07-14T19:00:00Z');
            expect(startOfWibDay(earlyMorningWib).toISOString()).toBe('2026-07-14T17:00:00.000Z');
            expect(startOfWibDay(new Date('2026-07-15T10:00:00Z')).toISOString()).toBe(
                '2026-07-14T17:00:00.000Z',
            );
        });

        it('rolls over at 17:00 UTC, not at midnight UTC', () => {
            expect(startOfWibDay(new Date('2026-07-15T16:59:59Z')).toISOString()).toBe(
                '2026-07-14T17:00:00.000Z',
            );
            expect(startOfWibDay(new Date('2026-07-15T17:00:00Z')).toISOString()).toBe(
                '2026-07-15T17:00:00.000Z',
            );
        });
    });

    describe('startOfWibWeek', () => {
        it('starts the week on WIB Monday', () => {
            // 2026-07-15 is a Wednesday in WIB; the Monday is 2026-07-13.
            expect(startOfWibWeek(new Date('2026-07-15T10:00:00Z')).toISOString()).toBe(
                '2026-07-12T17:00:00.000Z',
            );
        });

        it('treats a WIB Monday as its own week start', () => {
            expect(startOfWibWeek(new Date('2026-07-13T05:00:00Z')).toISOString()).toBe(
                '2026-07-12T17:00:00.000Z',
            );
        });
    });

    describe('startOfWibMonth', () => {
        it('anchors to WIB midnight on the 1st', () => {
            expect(startOfWibMonth(new Date('2026-07-15T10:00:00Z')).toISOString()).toBe(
                '2026-06-30T17:00:00.000Z',
            );
        });

        // 2026-07-01T02:00Z is still 30 June in WIB terms? No: it is 09:00 WIB
        // on 1 July. The trap is the other direction, late on the last day.
        it('files a late-UTC instant on the last WIB day into the right month', () => {
            expect(startOfWibMonth(new Date('2026-06-30T18:00:00Z')).toISOString()).toBe(
                '2026-06-30T17:00:00.000Z',
            );
        });
    });

    describe('addDays', () => {
        it('advances by exactly 24h, since WIB has no daylight saving', () => {
            expect(addDays(new Date('2026-07-14T17:00:00Z'), 1).toISOString()).toBe(
                '2026-07-15T17:00:00.000Z',
            );
        });

        it('goes backwards', () => {
            expect(addDays(new Date('2026-07-14T17:00:00Z'), -2).toISOString()).toBe(
                '2026-07-12T17:00:00.000Z',
            );
        });
    });

    describe('addWibMonths', () => {
        it('lands on WIB midnight of the 1st and crosses a year boundary', () => {
            expect(addWibMonths(new Date('2026-12-15T10:00:00Z'), 1).toISOString()).toBe(
                '2026-12-31T17:00:00.000Z',
            );
        });

        it('goes backwards across a year boundary', () => {
            expect(addWibMonths(new Date('2026-01-15T10:00:00Z'), -1).toISOString()).toBe(
                '2025-11-30T17:00:00.000Z',
            );
        });
    });

    describe('wibDateKey', () => {
        it('reports the WIB calendar date, not the UTC one', () => {
            // 19:00 UTC on the 14th is already 02:00 WIB on the 15th.
            expect(wibDateKey(new Date('2026-07-14T19:00:00Z'))).toBe('2026-07-15');
        });

        it('still reports the earlier date before the 17:00 UTC rollover', () => {
            expect(wibDateKey(new Date('2026-07-14T16:59:59Z'))).toBe('2026-07-14');
        });
    });

    describe('parseWibFilterDate', () => {
        it('reads a bare date as WIB midnight, not UTC midnight', () => {
            expect(parseWibFilterDate('2026-07-15').toISOString()).toBe('2026-07-14T17:00:00.000Z');
        });

        it('leaves a value with an explicit instant alone', () => {
            expect(parseWibFilterDate('2026-07-15T10:30:00Z').toISOString()).toBe(
                '2026-07-15T10:30:00.000Z',
            );
        });

        it('returns an invalid date unchanged rather than shifting garbage', () => {
            expect(Number.isNaN(parseWibFilterDate('not-a-date').getTime())).toBe(true);
        });
    });
});
