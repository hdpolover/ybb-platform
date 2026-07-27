import { Test, TestingModule } from '@nestjs/testing';
import { Brand } from '@prisma/client';
import { ActivityStrategy } from './activity.strategy';
import { ActivityRow } from './activity.mapper';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';

const brand = { id: 'brand-1' } as Brand;

function buildRows(count: number, overrides: Partial<ActivityRow> = {}): ActivityRow[] {
  return Array.from({ length: count }, (_, index) => ({
    status: 'accepted',
    full_name: `Person${index} Surname${index}`,
    nationality: 'Japan',
    nationality_code: 'JP',
    origin_country: null,
    program_name: 'AYIMUN',
    ...overrides,
  }));
}

describe('ActivityStrategy', () => {
  let strategy: ActivityStrategy;

  const mockPrismaService = { $queryRaw: jest.fn() };
  const mockCacheService = { get: jest.fn(), set: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCacheService.get.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityStrategy,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    strategy = module.get<ActivityStrategy>(ActivityStrategy);
  });

  it('returns disabled with no items when brand is null', async () => {
    const result = await strategy.getData(null);
    expect(result).toEqual({ enabled: false, items: [] });
    expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns disabled when the eligible pool is under the minimum', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue(buildRows(9));
    const result = await strategy.getData(brand);
    expect(result).toEqual({ enabled: false, items: [] });
  });

  it('returns enabled with mapped items once the pool reaches the minimum', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue(buildRows(10));
    const result = await strategy.getData(brand);
    expect(result.enabled).toBe(true);
    expect(result.items).toHaveLength(10);
    expect(result.items[0]).toEqual({
      type: 'accepted',
      name: 'Person0 S.',
      country: 'Japan',
      countryCode: 'JP',
      programName: 'AYIMUN',
    });
  });

  it('counts the pool after mapping, so unmappable rows cannot inflate it', async () => {
    const rows = [...buildRows(9), ...buildRows(3, { nationality: null, origin_country: null })];
    mockPrismaService.$queryRaw.mockResolvedValue(rows);
    const result = await strategy.getData(brand);
    expect(result).toEqual({ enabled: false, items: [] });
  });

  it('emits no identifying fields', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue(buildRows(10));
    const result = await strategy.getData(brand);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Surname0');
    expect(serialized).not.toContain('id');
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual(
        ['country', 'countryCode', 'name', 'programName', 'type'].sort(),
      );
    }
  });

  it('scopes the query to the requested brand id', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue(buildRows(10));
    await strategy.getData(brand);
    const params = mockPrismaService.$queryRaw.mock.calls[0].slice(1);
    expect(params).toContain('brand-1');
  });

  it('returns the cached value without querying', async () => {
    mockCacheService.get.mockResolvedValue({ enabled: true, items: buildRows(0) });
    await strategy.getData(brand);
    expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
  });

  it('caches the built result under the brand-scoped key', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue(buildRows(10));
    await strategy.getData(brand);
    expect(mockCacheService.set).toHaveBeenCalledWith(
      'landing:activity:brand-1',
      expect.objectContaining({ enabled: true }),
      5 * 60 * 1000,
    );
  });

  it('returns disabled instead of throwing when the query fails', async () => {
    mockPrismaService.$queryRaw.mockRejectedValue(new Error('db down'));
    const result = await strategy.getData(brand);
    expect(result).toEqual({ enabled: false, items: [] });
  });
});
