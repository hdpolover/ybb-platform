// src/modules/programs/application/services/scan-pricing-tier-alerts.util.ts
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { detectPricingTierAlerts, detectUncoveredCategories, PricingTierAlerts, UncoveredCategoryAlert } from './pricing-tier-alerts.util';

/**
 * Single query + detection pass shared by GetPricingTierAlertsSummaryHandler
 * (user-scoped, counts-only, for the dashboard badge) and
 * PricingTierCoverageAlertService (unscoped, full detail, for the daily ops
 * email). Extracted so the "which programs/tiers are in scope" query and the
 * detectPricingTierAlerts() call are each defined exactly once - see that
 * file's header for why a third copy of either is the thing to avoid.
 */
export type ProgramPricingTierAlerts = {
    programId: string;
    programName: string;
    brandName: string;
    registrationCloseDate: Date | null;
    alerts: PricingTierAlerts & { uncoveredCategories: UncoveredCategoryAlert[] };
};

export async function scanProgramsForPricingTierAlerts(
    prisma: PrismaService,
    scopeWhere: Prisma.ProgramWhereInput,
    now: Date = new Date(),
): Promise<ProgramPricingTierAlerts[]> {
    const programs = await prisma.program.findMany({
        where: {
            ...scopeWhere,
            // A draft or paused program going "unpurchasable" isn't the incident.
            isPublished: true,
            isActive: true,
            status: 'published',
        },
        select: {
            id: true,
            name: true,
            registrationCloseDate: true,
            brand: { select: { name: true } },
            pricingTiers: {
                // No `isActive` filter here (unlike before N-2026-09-09-E): an
                // inactive tier is exactly what the uncovered-category check
                // below needs to see, both to know a category was configured
                // at all and to confirm nothing currently covers it - the
                // MEYS 6th incident was an admin deactivating the only
                // fully_funded registration_fee tier. `deletedAt: null` is
                // still applied - PrismaService auto-injects it on findMany,
                // and this is a findMany - so a soft-deleted tier still
                // cannot resurrect a category or mask a real gap.
                select: {
                    id: true,
                    name: true,
                    isActive: true,
                    feeType: true,
                    allowedCategories: true,
                    validityPeriods: { select: { startDate: true, endDate: true } },
                },
            },
        },
    });

    const results: ProgramPricingTierAlerts[] = [];
    for (const program of programs) {
        // A program with literally zero pricing-tier rows (active or not) has
        // nothing configured to alert on - this is the ONLY case that should
        // produce silence, not "all tiers happen to be inactive right now".
        if (program.pricingTiers.length === 0) continue;

        const activeTiers = program.pricingTiers.filter((t) => t.isActive);
        const alerts = detectPricingTierAlerts(activeTiers, program.registrationCloseDate, now);
        const uncoveredCategories = detectUncoveredCategories(program.pricingTiers, now);
        if (alerts.lapsed.length === 0 && alerts.expiring.length === 0 && uncoveredCategories.length === 0) continue;
        results.push({
            programId: program.id,
            programName: program.name,
            brandName: program.brand.name,
            registrationCloseDate: program.registrationCloseDate,
            alerts: { ...alerts, uncoveredCategories },
        });
    }
    return results;
}
