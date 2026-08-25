// services/api/src/modules/platform-settings/application/services/impact-stats.service.spec.ts
import { ImpactStatsService } from './impact-stats.service';
import { PlatformSettingRepository } from '../../infrastructure/persistence/platform-setting.repository';
import { LandingCacheInvalidationService } from '@modules/brands/application/services/landing-cache-invalidation.service';

const makeRepo = (overrides: Partial<PlatformSettingRepository> = {}) =>
  ({
    get: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({ key: 'impact_stats', value: {}, updatedAt: new Date(), updatedBy: 'user-1' }),
    ...overrides,
  }) as unknown as PlatformSettingRepository;

const makeLandingCacheInvalidation = (overrides: Partial<LandingCacheInvalidationService> = {}) =>
  ({
    invalidateForAllBrands: jest.fn().mockResolvedValue({ succeeded: ['brand-1', 'brand-2'], failed: [] }),
    ...overrides,
  }) as unknown as LandingCacheInvalidationService;

describe('ImpactStatsService', () => {
  it('get() returns null fields when nothing has been set yet', async () => {
    const repo = makeRepo();
    const service = new ImpactStatsService(repo, makeLandingCacheInvalidation());
    expect(await service.get()).toEqual({
      totalAlumni: null,
      editionsHeld: null,
      totalCountries: null,
      totalParticipants: null,
    });
  });

  it('get() maps the stored snake_case JSON to camelCase', async () => {
    const repo = makeRepo({
      get: jest.fn().mockResolvedValue({
        key: 'impact_stats',
        value: { total_alumni: '1700+', editions_held: '15+', total_countries: '50+', total_participants: '1700+' },
        updatedAt: new Date(),
        updatedBy: null,
      }),
    });
    const service = new ImpactStatsService(repo, makeLandingCacheInvalidation());
    expect(await service.get()).toEqual({
      totalAlumni: '1700+',
      editionsHeld: '15+',
      totalCountries: '50+',
      totalParticipants: '1700+',
    });
  });

  it('update() upserts under the impact_stats key in snake_case, merged with the existing value', async () => {
    const repo = makeRepo({
      get: jest.fn().mockResolvedValue({ key: 'impact_stats', value: { total_alumni: '1700+' }, updatedAt: new Date(), updatedBy: null }),
    });
    const service = new ImpactStatsService(repo, makeLandingCacheInvalidation());

    await service.update({ editionsHeld: '16+' }, 'user-1');

    expect(repo.upsert).toHaveBeenCalledWith(
      'impact_stats',
      { total_alumni: '1700+', editions_held: '16+' },
      'user-1',
    );
  });

  describe('cache fan-out (Gap 1 + Gap 2: impact_stats is read by every brand, not one)', () => {
    it('update() fans out a cache purge to every brand, not a single brandId', async () => {
      const repo = makeRepo();
      const landingCacheInvalidation = makeLandingCacheInvalidation();
      const service = new ImpactStatsService(repo, landingCacheInvalidation);

      await service.update({ totalAlumni: '1800+' }, 'user-1');

      expect(landingCacheInvalidation.invalidateForAllBrands).toHaveBeenCalledWith({
        bustProgramCache: false,
        clearSnapshot: true,
        revalidate: { kind: 'homeAndSettings' },
      });
    });

    it('update() still returns the updated stats when the cache fan-out reports a partial failure', async () => {
      // A cache-layer failure for some brands must never fail the write that
      // already succeeded — matches every other landing-cache call site's
      // swallow convention (stale-until-TTL is the accepted fallback).
      const repo = makeRepo({
        get: jest.fn().mockResolvedValue({ key: 'impact_stats', value: { total_alumni: '1800+' }, updatedAt: new Date(), updatedBy: 'user-1' }),
      });
      const landingCacheInvalidation = makeLandingCacheInvalidation({
        invalidateForAllBrands: jest
          .fn()
          .mockResolvedValue({ succeeded: ['brand-1'], failed: [{ brandId: 'brand-2', error: 'redis down' }] }),
      });
      const service = new ImpactStatsService(repo, landingCacheInvalidation);

      const result = await service.update({ totalAlumni: '1800+' }, 'user-1');

      expect(result.totalAlumni).toBe('1800+');
    });

    it('update() does not call the cache fan-out before the upsert resolves', async () => {
      const repo = makeRepo();
      const landingCacheInvalidation = makeLandingCacheInvalidation();
      const service = new ImpactStatsService(repo, landingCacheInvalidation);
      const callOrder: string[] = [];
      (repo.upsert as jest.Mock).mockImplementation(async () => {
        callOrder.push('upsert');
        return { key: 'impact_stats', value: {}, updatedAt: new Date(), updatedBy: 'user-1' };
      });
      (landingCacheInvalidation.invalidateForAllBrands as jest.Mock).mockImplementation(async () => {
        callOrder.push('invalidateForAllBrands');
        return { succeeded: [], failed: [] };
      });

      await service.update({ totalAlumni: '1800+' }, 'user-1');

      expect(callOrder).toEqual(['upsert', 'invalidateForAllBrands']);
    });
  });
});
