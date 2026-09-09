// src/modules/metadata/metadata.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MetadataController } from './metadata.controller';
import { MetadataService } from './metadata.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

describe('MetadataController (audit M221 — public cache-key flooding)', () => {
  let controller: MetadataController;

  const mockMetadataService = {
    getStates: jest.fn(),
    getCities: jest.fn(),
    getTimezones: jest.fn(),
  };
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetadataController],
      providers: [
        { provide: MetadataService, useValue: mockMetadataService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    controller = module.get(MetadataController);
    jest.clearAllMocks();
    mockCacheService.get.mockResolvedValue(undefined);
  });

  // ── countryCode / stateCode bounding ────────────────────────────────────

  describe('getStates', () => {
    it('rejects a countryCode that is not a 2-letter code', async () => {
      await expect(controller.getStates('nope-not-a-code')).rejects.toThrow(BadRequestException);
      expect(mockCacheService.get).not.toHaveBeenCalled();
      expect(mockMetadataService.getStates).not.toHaveBeenCalled();
    });

    it('rejects an absurdly long countryCode instead of minting a new cache key for it', async () => {
      const flood = 'A'.repeat(5000);
      await expect(controller.getStates(flood)).rejects.toThrow(BadRequestException);
      expect(mockMetadataService.getStates).not.toHaveBeenCalled();
    });

    it('normalizes a valid code to uppercase before using it as the cache key', async () => {
      mockMetadataService.getStates.mockResolvedValue([{ isoCode: 'JK' }]);

      await controller.getStates('id');

      expect(mockCacheService.get).toHaveBeenCalledWith(CACHE_KEYS.METADATA_STATES('ID'));
      expect(mockMetadataService.getStates).toHaveBeenCalledWith('ID');
    });
  });

  describe('getCities', () => {
    it('rejects a malformed countryCode', async () => {
      await expect(controller.getCities('xx1', undefined)).rejects.toThrow(BadRequestException);
      expect(mockMetadataService.getCities).not.toHaveBeenCalled();
    });

    it('rejects a stateCode built to flood the keyspace', async () => {
      const flood = 'x'.repeat(1000);
      await expect(controller.getCities('ID', flood)).rejects.toThrow(BadRequestException);
      expect(mockMetadataService.getCities).not.toHaveBeenCalled();
    });

    it('accepts and normalizes valid country + state codes', async () => {
      mockMetadataService.getCities.mockResolvedValue([{ name: 'Jakarta' }]);

      await controller.getCities('id', 'jk');

      expect(mockCacheService.get).toHaveBeenCalledWith(CACHE_KEYS.METADATA_CITIES('ID', 'JK'));
      expect(mockMetadataService.getCities).toHaveBeenCalledWith('ID', 'JK');
    });
  });

  // ── timezones: unbounded `search` must never reach a cache key ─────────

  describe('getTimezones', () => {
    const allTimezones = ['Asia/Jakarta', 'Asia/Tokyo', 'America/New_York'];

    it('caches under ONE fixed key regardless of the search string, never keying on raw input', async () => {
      mockMetadataService.getTimezones.mockResolvedValue(allTimezones);

      await controller.getTimezones('anything-an-attacker-sends-here');
      await controller.getTimezones('a-completely-different-string');

      // Every call reads the SAME key — an attacker sending N distinct
      // search strings cannot mint N distinct Redis keys.
      expect(mockCacheService.get).toHaveBeenCalledWith(CACHE_KEYS.METADATA_TIMEZONES());
      expect(mockCacheService.get).toHaveBeenCalledTimes(2);
      const keysUsed = new Set(mockCacheService.get.mock.calls.map((call) => call[0]));
      expect(keysUsed.size).toBe(1);
    });

    it('filters the cached unfiltered list in memory rather than re-querying per search term', async () => {
      mockCacheService.get.mockResolvedValue(allTimezones);

      const result = await controller.getTimezones('jakarta');

      expect(result).toEqual(['Asia/Jakarta']);
      expect(mockMetadataService.getTimezones).not.toHaveBeenCalled();
    });

    it('returns the full list when no search is given', async () => {
      mockCacheService.get.mockResolvedValue(allTimezones);

      const result = await controller.getTimezones();

      expect(result).toEqual(allTimezones);
    });

    it('populates the cache from the service on a miss, unfiltered', async () => {
      mockMetadataService.getTimezones.mockResolvedValue(allTimezones);

      await controller.getTimezones('tokyo');

      expect(mockMetadataService.getTimezones).toHaveBeenCalledWith();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        CACHE_KEYS.METADATA_TIMEZONES(),
        allTimezones,
        expect.any(Number),
      );
    });
  });
});
