import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { LandingCacheInvalidationService } from './landing-cache-invalidation.service';
import { LandingRevalidationService } from './landing-revalidation.service';

const makePrismaService = () => ({
    brandLandingSnapshot: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    brand: {
        findMany: jest.fn().mockResolvedValue([]),
    },
});

const makeCacheService = () => ({
    invalidateBrandLandingCaches: jest.fn().mockResolvedValue(undefined),
    invalidateByPattern: jest.fn().mockResolvedValue(undefined),
    invalidateKey: jest.fn().mockResolvedValue(undefined),
    invalidateKeys: jest.fn().mockResolvedValue(undefined),
});

const makeLandingRevalidation = () => ({
    revalidateForBrand: jest.fn().mockResolvedValue(undefined),
    revalidateHomeAndSettingsForBrand: jest.fn().mockResolvedValue(undefined),
});

async function buildService(
    prisma: ReturnType<typeof makePrismaService>,
    cache: ReturnType<typeof makeCacheService>,
    landingRevalidation: ReturnType<typeof makeLandingRevalidation>,
): Promise<LandingCacheInvalidationService> {
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            LandingCacheInvalidationService,
            { provide: PrismaService, useValue: prisma },
            { provide: CacheService, useValue: cache },
            { provide: LandingRevalidationService, useValue: landingRevalidation },
        ],
    }).compile();
    return module.get<LandingCacheInvalidationService>(LandingCacheInvalidationService);
}

describe('LandingCacheInvalidationService', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('cache layer clearing', () => {
        it('clears the Postgres snapshot and Redis brand keys when clearSnapshot is true', async () => {
            // Arrange
            const prisma = makePrismaService();
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            await service.invalidate('brand-1', {
                clearSnapshot: true,
                bustProgramCache: false,
                swallowErrors: true,
                revalidate: { kind: 'skip' },
            });

            // Assert: both Postgres snapshot row and Redis brand-landing keys cleared
            expect(prisma.brandLandingSnapshot.deleteMany).toHaveBeenCalledWith({ where: { brandId: 'brand-1' } });
            expect(cache.invalidateBrandLandingCaches).toHaveBeenCalledWith('brand-1');
            expect(cache.invalidateByPattern).not.toHaveBeenCalled();
        });

        it('also busts the program:* Redis pattern when bustProgramCache is true', async () => {
            // Arrange
            const prisma = makePrismaService();
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            await service.invalidate('brand-1', {
                clearSnapshot: true,
                bustProgramCache: true,
                swallowErrors: true,
                revalidate: { kind: 'skip' },
            });

            // Assert
            expect(cache.invalidateByPattern).toHaveBeenCalledWith('program:*');
        });

        it('skips the Postgres snapshot delete when clearSnapshot is false', async () => {
            // Arrange
            const prisma = makePrismaService();
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            await service.invalidate('brand-1', {
                clearSnapshot: false,
                bustProgramCache: true,
                swallowErrors: false,
                revalidate: { kind: 'skip' },
            });

            // Assert
            expect(prisma.brandLandingSnapshot.deleteMany).not.toHaveBeenCalled();
        });
    });

    describe('revalidation hook', () => {
        it('invokes revalidateForBrand with the given urls when revalidate.kind is "brand"', async () => {
            // Arrange
            const prisma = makePrismaService();
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            await service.invalidate('brand-1', {
                clearSnapshot: true,
                bustProgramCache: false,
                swallowErrors: true,
                revalidate: { kind: 'brand', urls: { landingUrl: 'https://x.example', websiteUrl: null } },
            });

            // Assert
            expect(landingRevalidation.revalidateForBrand).toHaveBeenCalledWith('brand-1', {
                landingUrl: 'https://x.example',
                websiteUrl: null,
            });
            expect(landingRevalidation.revalidateHomeAndSettingsForBrand).not.toHaveBeenCalled();
        });

        it('invokes revalidateHomeAndSettingsForBrand when revalidate.kind is "homeAndSettings"', async () => {
            // Arrange
            const prisma = makePrismaService();
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            await service.invalidate('brand-42', {
                clearSnapshot: true,
                bustProgramCache: true,
                swallowErrors: true,
                revalidate: { kind: 'homeAndSettings' },
            });

            // Assert
            expect(landingRevalidation.revalidateHomeAndSettingsForBrand).toHaveBeenCalledWith('brand-42');
            expect(landingRevalidation.revalidateForBrand).not.toHaveBeenCalled();
        });

        it('calls neither revalidation method when revalidate.kind is "skip"', async () => {
            // Arrange
            const prisma = makePrismaService();
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            await service.invalidate('brand-1', {
                clearSnapshot: false,
                bustProgramCache: true,
                swallowErrors: false,
                revalidate: { kind: 'skip' },
            });

            // Assert
            expect(landingRevalidation.revalidateForBrand).not.toHaveBeenCalled();
            expect(landingRevalidation.revalidateHomeAndSettingsForBrand).not.toHaveBeenCalled();
        });

        it('busts every resolveBrand cache entry by pattern when revalidate.kind is "brand"', async () => {
            // resolveBrand()'s cache is keyed by the REQUEST host (cleanDomain()
            // output — bare, no scheme), not by the stored websiteUrl (which has
            // one) and not by brandId, so neither a key built from websiteUrl nor
            // invalidateBrandLandingCaches(brandId) can reach it. A pattern wipe
            // sidesteps reproducing cleanDomain's normalisation a second time.
            const prisma = makePrismaService();
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            await service.invalidate('brand-1', {
                clearSnapshot: true,
                bustProgramCache: false,
                swallowErrors: true,
                revalidate: { kind: 'brand', urls: { landingUrl: null, websiteUrl: 'https://example.com' } },
            });

            expect(cache.invalidateByPattern).toHaveBeenCalledWith(CACHE_KEYS.LANDING_BRAND_RESOLVE('*'));
        });

        it('busts resolveBrand cache entries even when websiteUrl is not known (domain may have changed)', async () => {
            const prisma = makePrismaService();
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            await service.invalidate('brand-1', {
                clearSnapshot: true,
                bustProgramCache: false,
                swallowErrors: true,
                revalidate: { kind: 'brand', urls: { landingUrl: null, websiteUrl: null } },
            });

            expect(cache.invalidateByPattern).toHaveBeenCalledWith(CACHE_KEYS.LANDING_BRAND_RESOLVE('*'));
        });

        it('skips the resolveBrand pattern bust when revalidate.kind is not "brand"', async () => {
            const prisma = makePrismaService();
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            await service.invalidate('brand-1', {
                clearSnapshot: true,
                bustProgramCache: false,
                swallowErrors: true,
                revalidate: { kind: 'homeAndSettings' },
            });

            expect(cache.invalidateByPattern).not.toHaveBeenCalledWith(CACHE_KEYS.LANDING_BRAND_RESOLVE('*'));
        });
    });

    describe('error handling', () => {
        it('swallows a throwing cache layer and logs it when swallowErrors is true', async () => {
            // Arrange: Redis layer explodes (e.g. connection drop mid-request)
            const prisma = makePrismaService();
            const cache = makeCacheService();
            cache.invalidateBrandLandingCaches.mockRejectedValue(new Error('redis down'));
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act / Assert: does not throw
            await expect(
                service.invalidate('brand-1', {
                    clearSnapshot: true,
                    bustProgramCache: false,
                    swallowErrors: true,
                    revalidate: { kind: 'skip' },
                }),
            ).resolves.toBeUndefined();

            // Assert: failure was logged, not silently dropped
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to invalidate landing caches:',
                expect.any(Error),
            );
        });

        it('still fires the revalidation hook even when cache clearing failed and was swallowed', async () => {
            // Arrange — mirrors update-brand/update-program: the revalidate call is a
            // separate statement that always runs, regardless of the cache-clear outcome.
            const prisma = makePrismaService();
            const cache = makeCacheService();
            cache.invalidateBrandLandingCaches.mockRejectedValue(new Error('redis down'));
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            await service.invalidate('brand-1', {
                clearSnapshot: true,
                bustProgramCache: false,
                swallowErrors: true,
                revalidate: { kind: 'homeAndSettings' },
            });

            // Assert
            expect(landingRevalidation.revalidateHomeAndSettingsForBrand).toHaveBeenCalledWith('brand-1');
        });

        it('propagates a throwing cache layer when swallowErrors is false', async () => {
            // Arrange — matches gallery.service.ts's original call site, which had no
            // try/catch: a cache failure must still surface to the caller.
            const prisma = makePrismaService();
            const cache = makeCacheService();
            cache.invalidateBrandLandingCaches.mockRejectedValue(new Error('redis down'));
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act / Assert
            await expect(
                service.invalidate('brand-1', {
                    clearSnapshot: false,
                    bustProgramCache: true,
                    swallowErrors: false,
                    revalidate: { kind: 'skip' },
                }),
            ).rejects.toThrow('redis down');

            // Assert: unlike the swallow path, nothing was logged here — the caller owns it
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('stops at the first failure instead of firing later tasks when swallowErrors is false', async () => {
            // Arrange — gallery's original code awaited invalidateBrandLandingCaches then
            // invalidateByPattern sequentially with no Promise.all; a first-call failure
            // meant the second call never ran. Preserve that fail-fast ordering.
            const prisma = makePrismaService();
            const cache = makeCacheService();
            cache.invalidateBrandLandingCaches.mockRejectedValue(new Error('redis down'));
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            await expect(
                service.invalidate('brand-1', {
                    clearSnapshot: false,
                    bustProgramCache: true,
                    swallowErrors: false,
                    revalidate: { kind: 'skip' },
                }),
            ).rejects.toThrow('redis down');

            // Assert
            expect(cache.invalidateByPattern).not.toHaveBeenCalled();
        });
    });

    describe('invalidateForAllBrands', () => {
        it('enumerates only active, non-deleted brands and purges each one', async () => {
            // Arrange
            const prisma = makePrismaService();
            prisma.brand.findMany.mockResolvedValue([{ id: 'brand-1' }, { id: 'brand-2' }]);
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            const result = await service.invalidateForAllBrands({ revalidate: { kind: 'homeAndSettings' } });

            // Assert: query scoped to active, non-deleted brands (matches
            // available_brands' own predicate — see this method's docstring)
            expect(prisma.brand.findMany).toHaveBeenCalledWith({
                where: { isActive: true, deletedAt: null },
                select: { id: true },
            });
            expect(cache.invalidateBrandLandingCaches).toHaveBeenCalledWith('brand-1');
            expect(cache.invalidateBrandLandingCaches).toHaveBeenCalledWith('brand-2');
            expect(landingRevalidation.revalidateHomeAndSettingsForBrand).toHaveBeenCalledWith('brand-1');
            expect(landingRevalidation.revalidateHomeAndSettingsForBrand).toHaveBeenCalledWith('brand-2');
            expect(result).toEqual({ succeeded: ['brand-1', 'brand-2'], failed: [] });
        });

        it('also clears the brandless "default" landing keys, which no per-brandId purge can reach', async () => {
            // Arrange
            const prisma = makePrismaService();
            prisma.brand.findMany.mockResolvedValue([{ id: 'brand-1' }]);
            const cache = makeCacheService();
            const service = await buildService(prisma, cache, makeLandingRevalidation());

            // Act
            const result = await service.invalidateForAllBrands({ revalidate: { kind: 'homeAndSettings' } });

            // Assert: a platform-wide setting (impact_stats) is served on the
            // brandless payload too, and that entry is keyed 'default'.
            expect(cache.invalidateKeys).toHaveBeenCalledWith([
                'landing:partners:default',
                'landing:home:default',
            ]);
            // The extra purge must not be miscounted as an extra brand.
            expect(result).toEqual({ succeeded: ['brand-1'], failed: [] });
        });

        it('reports a failed brandless purge instead of silently claiming full success', async () => {
            // Arrange
            const prisma = makePrismaService();
            prisma.brand.findMany.mockResolvedValue([{ id: 'brand-1' }]);
            const cache = makeCacheService();
            cache.invalidateKeys.mockRejectedValue(new Error('redis down for default scope'));
            const service = await buildService(prisma, cache, makeLandingRevalidation());

            // Act
            const result = await service.invalidateForAllBrands({ revalidate: { kind: 'homeAndSettings' } });

            // Assert
            expect(result.succeeded).toEqual(['brand-1']);
            expect(result.failed).toEqual([{ brandId: 'default', error: 'redis down for default scope' }]);
        });

        it('isolates one failing brand: the rest still get purged, and the failure is reported, not swallowed as success', async () => {
            // Arrange: brand-2's Redis layer explodes; brand-1 and brand-3 are healthy.
            const prisma = makePrismaService();
            prisma.brand.findMany.mockResolvedValue([{ id: 'brand-1' }, { id: 'brand-2' }, { id: 'brand-3' }]);
            const cache = makeCacheService();
            cache.invalidateBrandLandingCaches.mockImplementation((brandId: string) =>
                brandId === 'brand-2' ? Promise.reject(new Error('redis down for brand-2')) : Promise.resolve(undefined),
            );
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            const result = await service.invalidateForAllBrands({ revalidate: { kind: 'homeAndSettings' } });

            // Assert: brand-1 and brand-3 still purged despite brand-2's failure —
            // one bad brand must never halt the fan-out for the others.
            expect(landingRevalidation.revalidateHomeAndSettingsForBrand).toHaveBeenCalledWith('brand-1');
            expect(landingRevalidation.revalidateHomeAndSettingsForBrand).toHaveBeenCalledWith('brand-3');

            // Assert: brand-2's failure is reported explicitly, never folded into `succeeded` —
            // this is the guard against "a partial purge that reports success".
            expect(result.succeeded.sort()).toEqual(['brand-1', 'brand-3']);
            expect(result.failed).toEqual([{ brandId: 'brand-2', error: 'redis down for brand-2' }]);
        });

        it('forces swallowErrors:false per brand regardless of what the caller passed, so a real failure is observable here', async () => {
            // Arrange: caller passes swallowErrors: true (the write-path default) — this
            // method must override it internally, since it needs the rejection to record failure.
            const prisma = makePrismaService();
            prisma.brand.findMany.mockResolvedValue([{ id: 'brand-1' }]);
            const cache = makeCacheService();
            cache.invalidateBrandLandingCaches.mockRejectedValue(new Error('redis down'));
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            const result = await service.invalidateForAllBrands({
                swallowErrors: true,
                revalidate: { kind: 'homeAndSettings' },
            });

            // Assert: NOT reported as succeeded despite swallowErrors: true being passed in
            expect(result.succeeded).toEqual([]);
            expect(result.failed).toEqual([{ brandId: 'brand-1', error: 'redis down' }]);
            // Assert: revalidation hook never fired for the failed brand (clearCacheLayers
            // threw before fireRevalidation ran, matching swallowErrors:false semantics)
            expect(landingRevalidation.revalidateHomeAndSettingsForBrand).not.toHaveBeenCalled();
        });

        it('returns an empty result with no Prisma writes when there are no active brands', async () => {
            // Arrange
            const prisma = makePrismaService();
            prisma.brand.findMany.mockResolvedValue([]);
            const cache = makeCacheService();
            const landingRevalidation = makeLandingRevalidation();
            const service = await buildService(prisma, cache, landingRevalidation);

            // Act
            const result = await service.invalidateForAllBrands({ revalidate: { kind: 'homeAndSettings' } });

            // Assert
            expect(result).toEqual({ succeeded: [], failed: [] });
            expect(cache.invalidateBrandLandingCaches).not.toHaveBeenCalled();
        });
    });
});
