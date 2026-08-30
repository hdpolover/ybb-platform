// src/modules/programs/application/queries/handlers/get-pricing-tier-alerts-summary.handler.ts
import { Injectable } from '@nestjs/common';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { resolveRevenueAccessScope, buildProgramScopeWhere } from '@modules/stats/revenue/utils/revenue-access.util';
import { detectPricingTierAlerts } from '../../services/pricing-tier-alerts.util';

export class GetPricingTierAlertsSummaryQuery {
    constructor(public readonly user: CurrentUserData) { }
}

export type PricingTierAlertsSummaryItem = {
    programId: string;
    lapsedCount: number;
    expiringCount: number;
};

/**
 * Bulk counterpart to GetPricingTierAlertsHandler, for the program-list badge:
 * the per-program banner is reactive (an admin only sees it after opening that
 * program), so the dashboard home needs the same detection across every program
 * the caller can see without fanning out one request per card.
 *
 * One nested query fetches programs + active, non-deleted tiers + their
 * validity periods; detection then runs in memory via the same
 * detectPricingTierAlerts() the single-program endpoint uses, so the rule
 * (and the tier-period interval math it delegates to) is defined exactly once.
 */
@Injectable()
export class GetPricingTierAlertsSummaryHandler {
    constructor(private readonly readPrisma: PrismaReadService) { }

    async execute(query: GetPricingTierAlertsSummaryQuery): Promise<PricingTierAlertsSummaryItem[]> {
        const scope = await resolveRevenueAccessScope(this.readPrisma, query.user);
        const scopeWhere = buildProgramScopeWhere(scope);

        const programs = await this.readPrisma.program.findMany({
            where: {
                ...scopeWhere,
                // Same gate as the single-program alerts endpoint: a draft or
                // paused program going "unpurchasable" isn't the incident.
                isPublished: true,
                isActive: true,
                status: 'published',
            },
            select: {
                id: true,
                registrationCloseDate: true,
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

        const now = new Date();
        const summary: PricingTierAlertsSummaryItem[] = [];
        for (const program of programs) {
            if (program.pricingTiers.length === 0) continue;
            const alerts = detectPricingTierAlerts(program.pricingTiers, program.registrationCloseDate, now);
            if (alerts.lapsed.length === 0 && alerts.expiring.length === 0) continue;
            summary.push({
                programId: program.id,
                lapsedCount: alerts.lapsed.length,
                expiringCount: alerts.expiring.length,
            });
        }
        return summary;
    }
}
