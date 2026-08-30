// src/modules/programs/application/queries/handlers/get-pricing-tier-alerts-summary.handler.spec.ts
import {
    GetPricingTierAlertsSummaryHandler,
    GetPricingTierAlertsSummaryQuery,
} from './get-pricing-tier-alerts-summary.handler';
import * as revenueAccessUtil from '@modules/stats/revenue/utils/revenue-access.util';

const NOW = new Date('2026-08-30T04:00:00.000Z'); // 11:00 WIB, 30 Aug 2026 (same anchor as pricing-tier-alerts.util.spec.ts)

function period(start: string, end: string) {
    return { startDate: new Date(start), endDate: new Date(end) };
}

describe('GetPricingTierAlertsSummaryHandler', () => {
    let readPrisma: { program: { findMany: jest.Mock } };
    let handler: GetPricingTierAlertsSummaryHandler;

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(NOW);
        readPrisma = { program: { findMany: jest.fn() } };
        handler = new GetPricingTierAlertsSummaryHandler(readPrisma as any);

        // Scope resolution/authorization is covered by revenue-access.util.spec.ts;
        // this handler's own job is the fetch-once + group-by-program logic, so pin
        // the scope to "platform" (no restriction) and assert on the query it builds.
        jest.spyOn(revenueAccessUtil, 'resolveRevenueAccessScope').mockResolvedValue({
            kind: 'platform',
            allowedBrandIds: null,
            allowedProgramIds: null,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('scopes the query to published+active+status=published programs and non-deleted active tiers', async () => {
        readPrisma.program.findMany.mockResolvedValue([]);
        await handler.execute(new GetPricingTierAlertsSummaryQuery({ userId: 'u1' } as any));

        const args = readPrisma.program.findMany.mock.calls[0][0];
        expect(args.where).toMatchObject({ isPublished: true, isActive: true, status: 'published' });
        expect(args.select.pricingTiers.where).toEqual({ isActive: true, deletedAt: null });
    });

    it('groups lapsed, expiring, clean, and no-tier programs correctly, omitting the ones with no alerts', async () => {
        readPrisma.program.findMany.mockResolvedValue([
            {
                // lapsed: opened, no period covers now
                id: 'prog-lapsed',
                registrationCloseDate: null,
                pricingTiers: [
                    { id: 't1', name: 'Fully Funded', validityPeriods: [period('2026-08-01', '2026-08-20')] },
                ],
            },
            {
                // expiring: covers now, but coverage ends before registration close
                id: 'prog-expiring',
                registrationCloseDate: new Date('2026-11-02T17:00:00.000Z'),
                pricingTiers: [
                    { id: 't2', name: 'Regular', validityPeriods: [period('2026-08-25', '2026-09-01')] },
                ],
            },
            {
                // clean: fully covered through registration close
                id: 'prog-clean',
                registrationCloseDate: new Date('2026-09-05T17:00:00.000Z'),
                pricingTiers: [
                    { id: 't3', name: 'Regular', validityPeriods: [period('2026-08-25', '2026-09-10')] },
                ],
            },
            {
                // its only offending tier was soft-deleted, so the `where` on
                // pricingTiers already excludes it — this program reaches the
                // handler with an empty tiers array, same as one with none configured.
                id: 'prog-soft-deleted-tier-only',
                registrationCloseDate: null,
                pricingTiers: [],
            },
        ]);

        const result = await handler.execute(new GetPricingTierAlertsSummaryQuery({ userId: 'u1' } as any));

        expect(result).toEqual([
            { programId: 'prog-lapsed', lapsedCount: 1, expiringCount: 0 },
            { programId: 'prog-expiring', lapsedCount: 0, expiringCount: 1 },
        ]);
    });
});

// Unpublished/inactive/draft programs are excluded by the Prisma `where` itself
// (asserted in the "scopes the query" test above), so findMany never returns them
// to the handler in the first place — there is no separate in-memory re-filter to test.
