// services/api/src/modules/platform-settings/application/services/impact-stats.service.spec.ts
import { ImpactStatsService } from './impact-stats.service';
import { PlatformSettingRepository } from '../../infrastructure/persistence/platform-setting.repository';

describe('ImpactStatsService', () => {
  it('get() returns null fields when nothing has been set yet', async () => {
    const repo = { get: jest.fn().mockResolvedValue(null), upsert: jest.fn() } as unknown as PlatformSettingRepository;
    const service = new ImpactStatsService(repo);
    expect(await service.get()).toEqual({
      totalAlumni: null,
      editionsHeld: null,
      totalCountries: null,
      totalParticipants: null,
    });
  });

  it('get() maps the stored snake_case JSON to camelCase', async () => {
    const repo = {
      get: jest.fn().mockResolvedValue({
        key: 'impact_stats',
        value: { total_alumni: '1700+', editions_held: '15+', total_countries: '50+', total_participants: '1700+' },
        updatedAt: new Date(),
        updatedBy: null,
      }),
      upsert: jest.fn(),
    } as unknown as PlatformSettingRepository;
    const service = new ImpactStatsService(repo);
    expect(await service.get()).toEqual({
      totalAlumni: '1700+',
      editionsHeld: '15+',
      totalCountries: '50+',
      totalParticipants: '1700+',
    });
  });

  it('update() upserts under the impact_stats key in snake_case, merged with the existing value', async () => {
    const repo = {
      get: jest.fn().mockResolvedValue({ key: 'impact_stats', value: { total_alumni: '1700+' }, updatedAt: new Date(), updatedBy: null }),
      upsert: jest.fn().mockResolvedValue({ key: 'impact_stats', value: {}, updatedAt: new Date(), updatedBy: 'user-1' }),
    } as unknown as PlatformSettingRepository;
    const service = new ImpactStatsService(repo);

    await service.update({ editionsHeld: '16+' }, 'user-1');

    expect(repo.upsert).toHaveBeenCalledWith(
      'impact_stats',
      { total_alumni: '1700+', editions_held: '16+' },
      'user-1',
    );
  });
});
