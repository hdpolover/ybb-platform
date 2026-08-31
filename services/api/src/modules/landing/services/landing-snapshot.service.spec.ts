// services/api/src/modules/landing/services/landing-snapshot.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { LandingSnapshotService } from './landing-snapshot.service';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';

const brand = { id: 'brand-kys', name: 'Korea Youth Summit' } as never;

const validPayload = (marker: string) => ({
    slug: 'home',
    title: 'Home',
    sections: [{ type: 'marker', content: { marker } }],
});

describe('LandingSnapshotService', () => {
    let service: LandingSnapshotService;
    let prisma: { brandLandingSnapshot: { findUnique: jest.Mock; upsert: jest.Mock } };
    let cache: { get: jest.Mock; set: jest.Mock };

    beforeEach(async () => {
        prisma = {
            brandLandingSnapshot: {
                findUnique: jest.fn(),
                upsert: jest.fn().mockResolvedValue({}),
            },
        };
        cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LandingSnapshotService,
                { provide: PrismaService, useValue: prisma },
                { provide: CacheService, useValue: cache },
            ],
        }).compile();

        service = module.get(LandingSnapshotService);
    });

    /** The version this build stamps, read back off its own first write. */
    const currentVersion = async (): Promise<number> => {
        prisma.brandLandingSnapshot.findUnique.mockResolvedValue(null);
        await service.getOrBuildHomeSnapshot(brand, async () => validPayload('probe') as never);
        return prisma.brandLandingSnapshot.upsert.mock.calls[0][0].create.schemaVersion;
    };

    it('stamps a schema version that fits a Postgres int4', async () => {
        const version = await currentVersion();
        expect(version).toBeGreaterThan(0);
        expect(version).toBeLessThanOrEqual(2147483647);
    });

    it('serves a fresh snapshot written by this same build without rebuilding', async () => {
        const version = await currentVersion();
        const build = jest.fn();
        prisma.brandLandingSnapshot.findUnique.mockResolvedValue({
            payloadJson: validPayload('from-snapshot'),
            schemaVersion: version,
            publishedAt: new Date(),
        });

        const result: any = await service.getOrBuildHomeSnapshot(brand, build as never);

        expect(build).not.toHaveBeenCalled();
        expect(result.sections[0].content.marker).toBe('from-snapshot');
    });

    it('rebuilds instead of serving a fresh snapshot left behind by a previous build', async () => {
        const version = await currentVersion();
        const build = jest.fn().mockResolvedValue(validPayload('rebuilt'));
        prisma.brandLandingSnapshot.findUnique.mockResolvedValue({
            payloadJson: validPayload('stale-shape'),
            schemaVersion: version - 1, // written before the deploy
            publishedAt: new Date(), // still inside its TTL
        });

        const result: any = await service.getOrBuildHomeSnapshot(brand, build as never);

        expect(build).toHaveBeenCalled();
        expect(result.sections[0].content.marker).toBe('rebuilt');
    });

    it('scopes the Redis key by version so a previous build entry cannot be read', async () => {
        const version = await currentVersion();
        expect(cache.get).toHaveBeenLastCalledWith(expect.stringContaining(`:v${version}`));
    });

    // MEYS 6th/7th concurrent-active-programs bug: the /programs snapshot
    // must be keyed by the RESOLVED edition slug, or one edition's page gets
    // served for another.
    it('persists the programs snapshot under the resolved edition slug, not a shared row', async () => {
        prisma.brandLandingSnapshot.findUnique.mockResolvedValue(null);

        await service.getOrBuildProgramsSnapshot(brand, 'meys-6th', async () => validPayload('sixth') as never);
        await service.getOrBuildProgramsSnapshot(brand, 'meys-7th', async () => validPayload('seventh') as never);

        const slugs = prisma.brandLandingSnapshot.upsert.mock.calls.map((call) => call[0].create.slug);
        expect(slugs).toEqual(['meys-6th', 'meys-7th']);
    });

    it('keeps a single default row for brands with no currently-open edition', async () => {
        prisma.brandLandingSnapshot.findUnique.mockResolvedValue(null);

        await service.getOrBuildProgramsSnapshot(brand, null, async () => validPayload('default') as never);

        expect(prisma.brandLandingSnapshot.upsert.mock.calls[0][0].create.slug).toBe('');
    });
});
