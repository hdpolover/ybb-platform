// src/modules/programs/application/queries/handlers/get-pricing-tier-alerts-summary.handler.ts
import { Injectable } from '@nestjs/common';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { resolveRevenueAccessScope, buildProgramScopeWhere } from '@modules/stats/revenue/utils/revenue-access.util';
import { scanProgramsForPricingTierAlerts } from '../../services/scan-pricing-tier-alerts.util';

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
 * The query + detection pass live in scanProgramsForPricingTierAlerts(), shared
 * with PricingTierCoverageAlertService (the daily ops email) so the rule is
 * defined exactly once; this handler only adds the caller's access scope and
 * collapses the result to counts for the badge.
 */
@Injectable()
export class GetPricingTierAlertsSummaryHandler {
    constructor(private readonly readPrisma: PrismaReadService) { }

    async execute(query: GetPricingTierAlertsSummaryQuery): Promise<PricingTierAlertsSummaryItem[]> {
        const scope = await resolveRevenueAccessScope(this.readPrisma, query.user);
        const scopeWhere = buildProgramScopeWhere(scope);

        const results = await scanProgramsForPricingTierAlerts(this.readPrisma, scopeWhere);

        return results.map((r) => ({
            programId: r.programId,
            lapsedCount: r.alerts.lapsed.length,
            expiringCount: r.alerts.expiring.length,
        }));
    }
}
