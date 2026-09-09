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

    it('scopes the query to published+active+status=published programs and fetches every non-deleted tier (active or not)', async () => {
        readPrisma.program.findMany.mockResolvedValue([]);
        await handler.execute(new GetPricingTierAlertsSummaryQuery({ userId: 'u1' } as any));

        const args = readPrisma.program.findMany.mock.calls[0][0];
        expect(args.where).toMatchObject({ isPublished: true, isActive: true, status: 'published' });
        // N-2026-09-09-E: no `isActive` filter on pricingTiers any more - a
        // deactivated tier has to be visible to this query so the
        // uncovered-category check can tell "configured but deactivated"
        // apart from "never configured". `deletedAt: null` is still applied,
        // just no longer expressible as an explicit `where` here: it comes
        // from PrismaService auto-injecting it into every findMany.
        expect(args.select.pricingTiers.where).toBeUndefined();
        expect(args.select.pricingTiers.select).toMatchObject({
            isActive: true,
            feeType: true,
            allowedCategories: true,
        });
    });

    it('groups lapsed, expiring, clean, and no-tier programs correctly, omitting the ones with no alerts', async () => {
        readPrisma.program.findMany.mockResolvedValue([
            {
                // lapsed: opened, no period covers now
                id: 'prog-lapsed',
                name: 'Lapsed Program',
                brand: { name: 'Brand A' },
                registrationCloseDate: null,
                pricingTiers: [
                    {
                        id: 't1',
                        name: 'Fully Funded',
                        isActive: true,
                        feeType: 'full_fee',
                        allowedCategories: [],
                        validityPeriods: [period('2026-08-01', '2026-08-20')],
                    },
                ],
            },
            {
                // expiring: covers now, but coverage ends before registration close
                id: 'prog-expiring',
                name: 'Expiring Program',
                brand: { name: 'Brand B' },
                registrationCloseDate: new Date('2026-11-02T17:00:00.000Z'),
                pricingTiers: [
                    {
                        id: 't2',
                        name: 'Regular',
                        isActive: true,
                        feeType: 'full_fee',
                        allowedCategories: [],
                        validityPeriods: [period('2026-08-25', '2026-09-01')],
                    },
                ],
            },
            {
                // clean: fully covered through registration close
                id: 'prog-clean',
                name: 'Clean Program',
                brand: { name: 'Brand C' },
                registrationCloseDate: new Date('2026-09-05T17:00:00.000Z'),
                pricingTiers: [
                    {
                        id: 't3',
                        name: 'Regular',
                        isActive: true,
                        feeType: 'full_fee',
                        allowedCategories: [],
                        validityPeriods: [period('2026-08-25', '2026-09-10')],
                    },
                ],
            },
            {
                // its only offending tier was soft-deleted, so PrismaService's
                // auto-injected deletedAt:null already excludes it - this
                // program reaches the handler with an empty tiers array,
                // same as one with none configured.
                id: 'prog-soft-deleted-tier-only',
                name: 'Soft Deleted Tier Only',
                brand: { name: 'Brand D' },
                registrationCloseDate: null,
                pricingTiers: [],
            },
            {
                // MEYS 6th shape (N-2026-09-09-E): self_funded covered, the
                // only fully_funded registration_fee tier is deactivated.
                id: 'prog-uncovered-category',
                name: 'MEYS 6th',
                brand: { name: 'MEYS' },
                registrationCloseDate: null,
                pricingTiers: [
                    {
                        id: 't4',
                        name: 'Registration Fee (Self Funded)',
                        isActive: true,
                        feeType: 'registration_fee',
                        allowedCategories: ['self_funded'],
                        validityPeriods: [period('2026-08-01', '2026-12-31')],
                    },
                    {
                        id: 't5',
                        name: 'Registration Fee (Fully Funded)',
                        isActive: false,
                        feeType: 'registration_fee',
                        allowedCategories: ['fully_funded'],
                        validityPeriods: [period('2026-08-01', '2026-12-31')],
                    },
                ],
            },
        ]);

        const result = await handler.execute(new GetPricingTierAlertsSummaryQuery({ userId: 'u1' } as any));

        expect(result).toEqual([
            { programId: 'prog-lapsed', lapsedCount: 1, expiringCount: 0, uncoveredCount: 0 },
            { programId: 'prog-expiring', lapsedCount: 0, expiringCount: 1, uncoveredCount: 0 },
            { programId: 'prog-uncovered-category', lapsedCount: 0, expiringCount: 0, uncoveredCount: 1 },
        ]);
    });
});

// Unpublished/inactive/draft programs are excluded by the Prisma `where` itself
// (asserted in the "scopes the query" test above), so findMany never returns them
// to the handler in the first place — there is no separate in-memory re-filter to test.
