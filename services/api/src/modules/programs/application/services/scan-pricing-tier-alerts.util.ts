// src/modules/programs/application/services/scan-pricing-tier-alerts.util.ts
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { detectPricingTierAlerts, PricingTierAlerts } from './pricing-tier-alerts.util';

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
    alerts: PricingTierAlerts;
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
                // Soft-deleted tiers stay is_active=true in this database, so
                // isActive alone would fire on tiers deleted months ago.
                where: { isActive: true, deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    validityPeriods: { select: { startDate: true, endDate: true } },
                },
            },
        },
    });

    const results: ProgramPricingTierAlerts[] = [];
    for (const program of programs) {
        if (program.pricingTiers.length === 0) continue;
        const alerts = detectPricingTierAlerts(program.pricingTiers, program.registrationCloseDate, now);
        if (alerts.lapsed.length === 0 && alerts.expiring.length === 0) continue;
        results.push({
            programId: program.id,
            programName: program.name,
            brandName: program.brand.name,
            registrationCloseDate: program.registrationCloseDate,
            alerts,
        });
    }
    return results;
}
