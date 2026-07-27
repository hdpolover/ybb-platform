// src/modules/stats/participant-analytics.service.spec.ts

import { ParticipantAnalyticsService } from './participant-analytics.service';

type DailyRow = { day: string; count: number };

describe('ParticipantAnalyticsService', () => {
    const service = new ParticipantAnalyticsService({} as never, {} as never);

    // Private by design; exercised directly because the surrounding method is a
    // five-query fan-out that would need a full Prisma double to reach.
    const zeroFill = (rows: DailyRow[]): DailyRow[] =>
        (service as unknown as { zeroFillDailyTrend(r: DailyRow[]): DailyRow[] }).zeroFillDailyTrend(
            rows,
        );

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date('2026-07-18T10:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('zeroFillDailyTrend', () => {
        /**
         * The regression: the query only returns days that had at least one
         * registration, so the CYS outage day simply vanished from the chart and
         * the line interpolated straight across it. A registration incident was
         * invisible on the exact view you would open to spot one.
         */
        it('renders a registration outage as an explicit zero instead of dropping the day', () => {
            const filled = zeroFill([
                { day: '2026-07-14', count: 101 },
                { day: '2026-07-16', count: 169 },
            ]);

            expect(filled.slice(0, 3)).toEqual([
                { day: '2026-07-14', count: 101 },
                { day: '2026-07-15', count: 0 },
                { day: '2026-07-16', count: 169 },
            ]);
        });

        it('fills a multi-day gap', () => {
            const filled = zeroFill([
                { day: '2026-07-14', count: 5 },
                { day: '2026-07-18', count: 9 },
            ]);

            expect(filled.map((r) => r.count)).toEqual([5, 0, 0, 0, 9]);
        });

        it('extends trailing silence up to today so a stalled program is visible', () => {
            const filled = zeroFill([{ day: '2026-07-16', count: 4 }]);

            expect(filled).toEqual([
                { day: '2026-07-16', count: 4 },
                { day: '2026-07-17', count: 0 },
                { day: '2026-07-18', count: 0 },
            ]);
        });

        it('leaves an already-contiguous series untouched', () => {
            const rows = [
                { day: '2026-07-17', count: 2 },
                { day: '2026-07-18', count: 3 },
            ];

            expect(zeroFill(rows)).toEqual(rows);
        });

        it('returns an empty series unchanged rather than inventing 90 zeros', () => {
            expect(zeroFill([])).toEqual([]);
        });

        it('stays bounded by the query window even if the first day is far in the past', () => {
            expect(zeroFill([{ day: '2020-01-01', count: 1 }]).length).toBeLessThanOrEqual(91);
        });
    });
});
