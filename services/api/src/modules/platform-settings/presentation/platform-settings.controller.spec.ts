// services/api/src/modules/platform-settings/presentation/platform-settings.controller.spec.ts
import { PlatformSettingsController } from './platform-settings.controller';
import { ImpactStatsService } from '../application/services/impact-stats.service';

describe('PlatformSettingsController', () => {
  it('getImpactStats() delegates to the service', async () => {
    const service = { get: jest.fn().mockResolvedValue({ totalAlumni: '1700+' }), update: jest.fn() } as unknown as ImpactStatsService;
    const controller = new PlatformSettingsController(service);
    expect(await controller.getImpactStats()).toEqual({ totalAlumni: '1700+' });
  });

  it('updateImpactStats() passes the authenticated user id through', async () => {
    const service = { get: jest.fn(), update: jest.fn().mockResolvedValue({ totalAlumni: '1800+' }) } as unknown as ImpactStatsService;
    const controller = new PlatformSettingsController(service);
    const result = await controller.updateImpactStats({ totalAlumni: '1800+' }, { user: { id: 'user-1' } } as any);
    expect(service.update).toHaveBeenCalledWith({ totalAlumni: '1800+' }, 'user-1');
    expect(result).toEqual({ totalAlumni: '1800+' });
  });
});
