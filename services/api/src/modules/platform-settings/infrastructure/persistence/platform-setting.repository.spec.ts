// services/api/src/modules/platform-settings/infrastructure/persistence/platform-setting.repository.spec.ts
import { PlatformSettingRepository } from './platform-setting.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function mkPrisma(existing?: { key: string; value: unknown }): PrismaService {
  const base: any = {
    platformSetting: {
      findUnique: jest.fn().mockResolvedValue(existing ? { ...existing, updatedAt: new Date(), updatedBy: null } : null),
      upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ ...create, updatedAt: new Date() })),
    },
  };
  return base as PrismaService;
}

describe('PlatformSettingRepository', () => {
  it('get() returns null when the key has never been set', async () => {
    const prisma = mkPrisma();
    const repo = new PlatformSettingRepository(prisma);
    expect(await repo.get('impact_stats')).toBeNull();
  });

  it('get() returns the stored value for an existing key', async () => {
    const prisma = mkPrisma({ key: 'impact_stats', value: { total_alumni: '1700+' } });
    const repo = new PlatformSettingRepository(prisma);
    const result = await repo.get('impact_stats');
    expect(result?.value).toEqual({ total_alumni: '1700+' });
  });

  it('upsert() writes via key-based upsert, not a raw update', async () => {
    const prisma = mkPrisma();
    const repo = new PlatformSettingRepository(prisma);
    await repo.upsert('impact_stats', { total_alumni: '1700+' }, 'user-1');
    expect((prisma as any).platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'impact_stats' },
      create: { key: 'impact_stats', value: { total_alumni: '1700+' }, updatedBy: 'user-1' },
      update: { value: { total_alumni: '1700+' }, updatedBy: 'user-1' },
    });
  });
});
