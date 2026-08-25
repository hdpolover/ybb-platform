// services/api/scripts/purge-landing-caches-all-brands.ts
/**
 * purge-landing-caches-all-brands.ts
 *
 * Phase 3 Task 17 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md).
 * Purges all three landing-cache layers (Redis, brand_landing_snapshots,
 * and ybb-program-next's unstable_cache via the revalidate webhook) for
 * every active, non-deleted brand, using the same
 * LandingCacheInvalidationService.invalidateForAllBrands() every write-path
 * handler in this codebase already builds on for a single brand.
 *
 * Bootstraps the full Nest application context (no HTTP listener) rather
 * than hand-constructing CacheService/LandingRevalidationService — see this
 * task's plan-doc entry for why.
 *
 * Deviation from this task's original brief: the brief's draft hand-rolled
 * its own "list brands, call invalidate() per brand, count succeeded/failed"
 * loop directly in this script. That loop is now a real gap in the codebase
 * on its own — impact_stats (a single PlatformSetting row read by every
 * brand's home page) needed the exact same fan-out-with-per-brand-isolation
 * logic to fix its own missing cache invalidation (see
 * ImpactStatsService.update()). Duplicating "enumerate active brands, purge
 * each one, isolate one brand's failure from the rest" in two places risked
 * the two copies drifting apart, so that logic now lives once, on
 * LandingCacheInvalidationService.invalidateForAllBrands() — this script is
 * a thin CLI wrapper around it, not a second implementation.
 *
 * Makes no Postgres schema/data changes, but DOES have an observable side
 * effect (busts caches, fires the ybb-program-next revalidate webhook), so
 * it still respects --apply like this phase's other scripts: dry run lists
 * which brands would be purged, --apply actually purges them.
 *
 * USAGE (from services/api):
 *   npx ts-node -r tsconfig-paths/register scripts/purge-landing-caches-all-brands.ts            # dry run
 *   npx ts-node -r tsconfig-paths/register scripts/purge-landing-caches-all-brands.ts --apply    # execute
 *
 * NEVER run --apply against production from an interactive agent session —
 * see this plan's Global Constraints. Running this against production,
 * immediately after Task 16 deploys, is a separate human-approved
 * deployment step.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../src/modules/brands/application/services/landing-cache-invalidation.service';

async function main(): Promise<void> {
    const APPLY = process.argv.includes('--apply');
    console.log(`[purge-landing-caches-all-brands] mode: ${APPLY ? 'APPLY (will purge caches + fire revalidation)' : 'DRY RUN (list only)'}`);

    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    try {
        // strict: false — resolve these from anywhere in the container, not
        // only from providers BrandsModule/PrismaModule explicitly export.
        const prisma = app.get(PrismaService, { strict: false });
        const landingCacheInvalidation = app.get(LandingCacheInvalidationService, { strict: false });

        // Same predicate invalidateForAllBrands() itself queries with — kept
        // here too so the dry-run listing can print names/slugs without
        // having to actually invoke the purge.
        const brands = await prisma.brand.findMany({
            where: { isActive: true, deletedAt: null },
            select: { id: true, name: true, slug: true },
            orderBy: { name: 'asc' },
        });

        console.log(`[purge-landing-caches-all-brands] ${brands.length} active brand(s) to purge:`);
        console.table(brands.map((b) => ({ brand: b.name, slug: b.slug, id: b.id })));

        if (!APPLY) {
            console.log('[purge-landing-caches-all-brands] DRY RUN complete. Re-run with --apply to purge the brands above.');
            return;
        }

        const result = await landingCacheInvalidation.invalidateForAllBrands({
            revalidate: { kind: 'homeAndSettings' },
        });

        const brandNameById = new Map(brands.map((b) => [b.id, b.name]));
        for (const brandId of result.succeeded) {
            console.log(`[purge-landing-caches-all-brands] purged: ${brandNameById.get(brandId) ?? brandId}`);
        }
        for (const failure of result.failed) {
            console.error(
                `[purge-landing-caches-all-brands] FAILED for ${brandNameById.get(failure.brandId) ?? failure.brandId}: ${failure.error}`,
            );
        }

        console.log(
            `[purge-landing-caches-all-brands] done. ${result.succeeded.length} succeeded, ${result.failed.length} failed.`,
        );
        if (result.failed.length > 0) process.exitCode = 1;
    } finally {
        await app.close();
    }
}

main().catch((err) => {
    console.error('[purge-landing-caches-all-brands] FAILED:', err);
    process.exitCode = 1;
});
