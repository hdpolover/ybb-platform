// services/api/src/modules/landing/strategies/partners-sponsors.strategy.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PartnersSponsorsStrategy } from './partners-sponsors.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { LandingSnapshotService } from '../services/landing-snapshot.service';
import { PlatformSettingRepository } from '@modules/platform-settings/infrastructure/persistence/platform-setting.repository';

describe('PartnersSponsorsStrategy impact stats', () => {
    let strategy: PartnersSponsorsStrategy;

    const mockPrismaService = {
        sponsor: { findMany: jest.fn().mockResolvedValue([]) },
        programPartner: { findMany: jest.fn().mockResolvedValue([]) },
        program: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
    };
    // Snapshot layer is a pass-through here: this spec is about the payload the
    // builder produces, not about snapshot caching.
    const mockLandingSnapshotService = {
        getOrBuildPartnersSnapshot: jest.fn((_brand: unknown, build: () => Promise<unknown>) => build()),
    };
    const mockPlatformSettingRepository = { get: jest.fn().mockResolvedValue(null) };

    const brand = { id: 'brand-1', name: 'Test Brand', metadata: {} };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PartnersSponsorsStrategy,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: CacheService, useValue: mockCacheService },
                { provide: LandingSnapshotService, useValue: mockLandingSnapshotService },
                { provide: PlatformSettingRepository, useValue: mockPlatformSettingRepository },
            ],
        }).compile();

        strategy = module.get(PartnersSponsorsStrategy);
        jest.clearAllMocks();
        mockPrismaService.sponsor.findMany.mockResolvedValue([]);
        mockPrismaService.programPartner.findMany.mockResolvedValue([]);
        mockPrismaService.program.findMany.mockResolvedValue([]);
        mockLandingSnapshotService.getOrBuildPartnersSnapshot.mockImplementation(
            (_brand: unknown, build: () => Promise<unknown>) => build(),
        );
    });

    it('carries the same platform-wide impact_stats row the home page reads', async () => {
        mockPlatformSettingRepository.get.mockResolvedValue({
            key: 'impact_stats',
            value: { total_participants: '1700+', total_countries: '50+' },
            updatedAt: new Date(),
            updatedBy: null,
        });

        const result: any = await strategy.getData(brand as never);
        const impact = result.sections.find((s: any) => s.type === 'program_impact');

        expect(mockPlatformSettingRepository.get).toHaveBeenCalledWith('impact_stats');
        expect(impact.content.stats).toEqual([
            { id: 'participants', label: 'Total Participants', value: '1700+', icon: 'participants' },
            { id: 'countries', label: 'Total Countries', value: '50+', icon: 'countries' },
        ]);
    });

    it('omits the section when the impact_stats row is missing, so /partners renders no invented figure', async () => {
        mockPlatformSettingRepository.get.mockResolvedValue(null);

        const result: any = await strategy.getData(brand as never);

        expect(result.sections.find((s: any) => s.type === 'program_impact')).toBeUndefined();
    });
});
