
import { Test, TestingModule } from '@nestjs/testing';
import { LandingService } from './landing.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { HomeStrategy } from './strategies/home.strategy';
import { AboutStrategy } from './strategies/about.strategy';
import { ProgramsStrategy } from './strategies/programs.strategy';
import { PartnersSponsorsStrategy } from './strategies/partners-sponsors.strategy';
import { AnnouncementsStrategy } from './strategies/announcements.strategy';
import { SettingsStrategy } from './strategies/settings.strategy';
import { FaqsStrategy } from './strategies/faqs.strategy';
import { ActivityStrategy } from './strategies/activity.strategy';
import { LandingSnapshotService } from './services/landing-snapshot.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { NotFoundException } from '@nestjs/common';

describe('LandingService', () => {
  let service: LandingService;
  let prismaService: any;
  let homeStrategy: any;
  let cacheService: { get: jest.Mock; set: jest.Mock };

  const mockPrismaService = {
    brand: {
      findFirst: jest.fn(),
    },
  };

  const mockStrategy = {
    getData: jest.fn(),
    getProgramData: jest.fn(),
  };

  const mockLandingSnapshotService = {
    getOrBuildHomeSnapshot: jest.fn(async (_brand: unknown, build: () => Promise<unknown>) => build()),
    getOrBuildProgramsSnapshot: jest.fn(async (_brand: unknown, build: () => Promise<unknown>) => build()),
    getOrBuildProgramDetailSnapshot: jest.fn(async (_brand: unknown, _slug: string, build: () => Promise<unknown>) => build()),
  };

  beforeEach(async () => {
    const mockCacheService = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LandingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HomeStrategy, useValue: mockStrategy },
        { provide: AboutStrategy, useValue: mockStrategy },
        { provide: ProgramsStrategy, useValue: mockStrategy },
        { provide: PartnersSponsorsStrategy, useValue: mockStrategy },
        { provide: AnnouncementsStrategy, useValue: mockStrategy },
        { provide: SettingsStrategy, useValue: mockStrategy },
        { provide: FaqsStrategy, useValue: mockStrategy },
        { provide: ActivityStrategy, useValue: mockStrategy },
        { provide: LandingSnapshotService, useValue: mockLandingSnapshotService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<LandingService>(LandingService);
    prismaService = module.get<PrismaService>(PrismaService);
    homeStrategy = module.get<HomeStrategy>(HomeStrategy);
    cacheService = module.get<CacheService>(CacheService) as unknown as { get: jest.Mock; set: jest.Mock };

    jest.clearAllMocks();
  });

  describe('resolveCategory', () => {
    it('should find category by exact URL', async () => {
      const mockCategory = { id: 'cat-1', websiteUrl: 'https://ybb.co', isActive: true };
      mockPrismaService.brand.findFirst.mockResolvedValue(mockCategory);

      // We interpret calling a public method that uses private resolveCategory to test it
      await service.getHome('https://ybb.co');

      expect(mockPrismaService.brand.findFirst).toHaveBeenCalledWith({
        where: { websiteUrl: 'https://ybb.co', isActive: true },
      });
    });

    it('should find category by partial URL if exact fails', async () => {
        // First call (Exact) returns null
        mockPrismaService.brand.findFirst
            .mockResolvedValueOnce(null) 
            // Second call (Partial) returns category
            .mockResolvedValueOnce({ id: 'cat-partial', websiteUrl: 'https://other.com', isActive: true });

        await service.getHome('other.com');

        expect(mockPrismaService.brand.findFirst).toHaveBeenCalledTimes(2);
        // Verify second call args
        expect(mockPrismaService.brand.findFirst).toHaveBeenLastCalledWith({
            where: {
                websiteUrl: { contains: 'other.com', mode: 'insensitive' },
                isActive: true
            }
        });
    });

    it('should return default category if no URL provided', async () => {
        const mockDefault = { id: 'default-cat' };
        mockPrismaService.brand.findFirst.mockResolvedValue(mockDefault);

        await service.getHome();

        expect(mockPrismaService.brand.findFirst).toHaveBeenCalledWith({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' }
        });
    });

    it('should throw NotFoundException if no category matches URL', async () => {
        mockPrismaService.brand.findFirst.mockResolvedValue(null);

        await expect(service.getHome('unknown.com')).rejects.toThrow(NotFoundException);
    });

    it('serves resolveBrand from cache on a hit, without querying the DB', async () => {
        cacheService.get.mockResolvedValue({ id: 'cached-brand', websiteUrl: 'https://ybb.co', isActive: true });

        await service.getHome('https://ybb.co');

        expect(mockPrismaService.brand.findFirst).not.toHaveBeenCalled();
    });

    it('caches a resolved brand after a cache miss, keyed by the normalised (lowercased, trimmed) URL', async () => {
        const mockCategory = { id: 'cat-1', websiteUrl: 'https://ybb.co', isActive: true };
        mockPrismaService.brand.findFirst.mockResolvedValue(mockCategory);

        await service.getHome('  HTTPS://YBB.CO  ');

        expect(cacheService.set).toHaveBeenCalledWith('landing:brand-resolve:https://ybb.co', mockCategory, expect.any(Number));
    });

    it('does not cache a not-found lookup', async () => {
        mockPrismaService.brand.findFirst.mockResolvedValue(null);

        await expect(service.getHome('unknown.com')).rejects.toThrow(NotFoundException);
        expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('Strategy Delegation', () => {
    it('getHome should call HomeStrategy', async () => {
        mockPrismaService.brand.findFirst.mockResolvedValue({ id: 'cat-1' });
        await service.getHome();
        expect(mockStrategy.getData).toHaveBeenCalledWith({ id: 'cat-1' });
    });

    it('getProgramDetail should call ProgramsStrategy.getProgramData', async () => {
        mockPrismaService.brand.findFirst.mockResolvedValue({ id: 'cat-1' });
        await service.getProgramDetail('slug-1');
        expect(mockStrategy.getProgramData).toHaveBeenCalledWith('slug-1', { id: 'cat-1' });
    });

    it('getActivity should strip any fields beyond the five permitted keys', async () => {
        mockPrismaService.brand.findFirst.mockResolvedValue({ id: 'cat-1' });
        mockStrategy.getData.mockResolvedValue({
          enabled: true,
          items: [
            {
              id: 'app-123',
              participantId: 'p-456',
              createdAt: '2026-07-27T00:00:00Z',
              type: 'registered',
              name: 'Yuki T.',
              country: 'Japan',
              countryCode: 'JP',
              programName: 'AYIMUN',
            },
          ],
        });

        const result = await service.getActivity();

        expect(result.items).toHaveLength(1);
        expect(Object.keys(result.items[0]).sort()).toEqual(
          ['countryCode', 'country', 'name', 'programName', 'type'].sort(),
        );
        expect(result.items[0]).not.toHaveProperty('id');
        expect(result.items[0]).not.toHaveProperty('participantId');
        expect(result.items[0]).not.toHaveProperty('createdAt');
    });
  });
});
