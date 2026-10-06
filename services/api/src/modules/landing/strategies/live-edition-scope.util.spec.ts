// services/api/src/modules/landing/strategies/live-edition-scope.util.spec.ts
import { loadDistributionApplications } from './live-edition-scope.util';

const row = (originCountry: string) => ({ participant: { originCountry, nationality: null } });

describe('loadDistributionApplications', () => {
  const findMany = jest.fn();
  const prisma = { participantApplication: { findMany } } as never;

  beforeEach(() => findMany.mockReset());

  it('counts only applications of the brand\'s live editions', async () => {
    findMany.mockResolvedValueOnce([row('ID'), row('JP')]);

    const result = await loadDistributionApplications(prisma, 'brand-1');

    expect(result).toEqual([row('ID'), row('JP')]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      deletedAt: null,
      participant: { deletedAt: null },
      program: {
        brandId: 'brand-1',
        isPublished: true,
        isActive: true,
        status: { in: ['published', 'ongoing'] },
        deletedAt: null,
      },
    });
  });

  it('shows a single application rather than padding it with older editions', async () => {
    // From its first application on, a new edition (JYS 5th, 2026-10-06) stands on its own numbers.
    findMany.mockResolvedValueOnce([row('ID')]);

    const result = await loadDistributionApplications(prisma, 'brand-1');

    expect(result).toHaveLength(1);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to every published edition when the live editions have no applications', async () => {
    // World Youth Fest: the live edition still registers on the legacy system,
    // so it has no rows here and a strict scope would blank the map.
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([row('NG'), row('IN')]);

    const result = await loadDistributionApplications(prisma, 'brand-1');

    expect(result).toEqual([row('NG'), row('IN')]);
    expect(findMany.mock.calls[0][0].where.program).toMatchObject({ isActive: true });
    const fallbackProgramWhere = findMany.mock.calls[1][0].where.program;
    expect(fallbackProgramWhere).toEqual({ brandId: 'brand-1', isPublished: true, deletedAt: null });
  });
});
