import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { StatSection } from './dto/get-stats.dto';

describe('StatsService', () => {
  let service: StatsService;
  const mockPrismaService = {
    brand: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    participant: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    participantApplication: {
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
    jest.clearAllMocks();
  });

  it('returns impact stats using COUNT(DISTINCT origin_country)', async () => {
    mockPrismaService.brand.findUnique.mockResolvedValue({ id: 'brand-1' });
    mockCacheService.get.mockResolvedValue(null);
    mockPrismaService.participant.count.mockResolvedValue(120);
    mockPrismaService.participantApplication.count.mockResolvedValue(32);
    mockPrismaService.$queryRaw.mockResolvedValue([{ count: 18n }]);

    const result = await service.getStats({
      brandId: 'brand-1',
      sections: [StatSection.IMPACT],
    });

    expect(result.impact).toEqual({
      total_participants: 120,
      total_countries: 18,
      alumni: 32,
    });
    expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns geography stats with distinct-country total from raw SQL', async () => {
    mockPrismaService.brand.findUnique.mockResolvedValue({ id: 'brand-1' });
    mockCacheService.get.mockResolvedValue(null);
    mockPrismaService.participant.count.mockResolvedValue(10);
    mockPrismaService.participant.groupBy.mockResolvedValue([
      { originCountry: 'Indonesia', _count: { id: 6 } },
      { originCountry: 'Japan', _count: { id: 2 } },
    ]);
    mockPrismaService.$queryRaw.mockResolvedValue([{ count: 4 }]);

    const result = await service.getStats({
      brandId: 'brand-1',
      sections: [StatSection.GEOGRAPHY],
      page: 1,
      limit: 2,
    });

    expect(result.geography).toEqual({
      items: [
        { country: 'Indonesia', participants: 6, percentage: 60 },
        { country: 'Japan', participants: 2, percentage: 20 },
      ],
      meta: {
        total: 4,
        page: 1,
        limit: 2,
        totalPages: 2,
      },
    });
    expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
