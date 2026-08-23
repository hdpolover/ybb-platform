import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { LandingCacheInvalidationService } from './landing-cache-invalidation.service';
import { LandingRevalidationService } from './landing-revalidation.service';

const makePrismaService = () => ({
    brandLandingSnapshot: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
});

const makeCacheService = () => ({
    invalidateBrandLandingCaches: jest.fn().mockResolvedValue(undefined),
    invalidateByPattern: jest.fn().mockResolvedValue(undefined),
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
});
