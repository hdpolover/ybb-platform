import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { LandingRevalidationService } from './landing-revalidation.service';

/**
 * Which LandingRevalidationService call (if any) to fire once the Redis and
 * Postgres cache layers are cleared. A discriminated union so a caller can't
 * accidentally pass brand urls to the home+settings variant or vice versa.
 */
export type LandingRevalidationRequest =
    | { kind: 'brand'; urls?: { landingUrl?: string | null; websiteUrl?: string | null } | null }
    | { kind: 'homeAndSettings' }
    | { kind: 'skip' };

export interface InvalidateLandingCachesOptions {
    /**
     * Also SCAN+DEL the `program:*` Redis keys. Program and gallery writes
     * touch program-scoped landing data; a brand-detail-only edit doesn't.
     * Defaults to true, matching two of the three original call sites.
     */
    bustProgramCache?: boolean;
    /**
     * Delete the brand's `brand_landing_snapshots` row (the Postgres cache
     * layer). Defaults to true; pass false only for a write that genuinely
     * never touches snapshot-cached data.
     */
    clearSnapshot?: boolean;
    /**
     * Catch + log failures instead of letting them propagate. Every current
     * call site wants this: the DB write has already succeeded by the time
     * this runs, so a cache-layer miss must surface as a stale-until-TTL page,
     * not a 500 on a request that actually succeeded. Also controls whether
     * cache-clear tasks run concurrently (true, via Promise.all) or
     * sequentially and stop at the first failure (false). Defaults to true.
     */
    swallowErrors?: boolean;
    /** Which post-clear revalidation hook, if any, to fire. Required so every
     *  call site makes a conscious choice instead of silently getting none. */
    revalidate: LandingRevalidationRequest;
}

/**
 * Single entry point for busting all three landing-page cache layers:
 *   1. Redis (`landing:*`, optionally `program:*`)
 *   2. Postgres `brand_landing_snapshots`
 *   3. The participant frontend's Next.js unstable_cache (via HTTP revalidate hook)
 *
 * A write is only publicly visible once all three are cleared. This used to
 * be a copy-pasted `private invalidateLandingCaches` method (plus a separate
 * LandingRevalidationService call) in update-brand.handler.ts,
 * update-program.handler.ts, and gallery.service.ts — each slightly
 * different, and every new handler risked forgetting a layer. Consolidated
 * here so a handler needs exactly one call.
 */
@Injectable()
export class LandingCacheInvalidationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingRevalidation: LandingRevalidationService,
    ) { }

    async invalidate(brandId: string, options: InvalidateLandingCachesOptions): Promise<void> {
        const {
            bustProgramCache = true,
            clearSnapshot = true,
            swallowErrors = true,
        } = options;

        await this.clearCacheLayers(brandId, { bustProgramCache, clearSnapshot, swallowErrors });

        // LandingRevalidationService's methods already catch + log their own
        // HTTP failures (see landing-revalidation.service.ts), so they never
        // throw. Firing this unconditionally — outside the swallow above —
        // mirrors every pre-refactor call site, which invoked it as a
        // separate statement regardless of how cache clearing above went.
        await this.fireRevalidation(brandId, options.revalidate);
    }

    private async clearCacheLayers(
        brandId: string,
        { bustProgramCache, clearSnapshot, swallowErrors }: { bustProgramCache: boolean; clearSnapshot: boolean; swallowErrors: boolean },
    ): Promise<void> {
        const tasks: Array<() => Promise<unknown>> = [];
        if (clearSnapshot) {
            tasks.push(() => this.prisma.brandLandingSnapshot.deleteMany({ where: { brandId } }));
        }
        tasks.push(() => this.cacheService.invalidateBrandLandingCaches(brandId));
        if (bustProgramCache) {
            tasks.push(() => this.cacheService.invalidateByPattern('program:*'));
        }

        if (!swallowErrors) {
            // No safety net requested: run sequentially so a failure both
            // propagates AND stops later tasks from firing, exactly like the
            // un-wrapped sequential `await`s this replaces.
            for (const run of tasks) {
                await run();
            }
            return;
        }

        try {
            await Promise.all(tasks.map((run) => run()));
        } catch (error) {
            // Cache invalidation failures must never fail the write that
            // triggered them — the admin's save already succeeded; a stale
            // landing page for up to the cache TTL is the acceptable fallback.
            console.error('Failed to invalidate landing caches:', error);
        }
    }

    private async fireRevalidation(brandId: string, request: LandingRevalidationRequest): Promise<void> {
        switch (request.kind) {
            case 'brand':
                await this.landingRevalidation.revalidateForBrand(brandId, request.urls);
                return;
            case 'homeAndSettings':
                await this.landingRevalidation.revalidateHomeAndSettingsForBrand(brandId);
                return;
            case 'skip':
                return;
        }
    }
}
