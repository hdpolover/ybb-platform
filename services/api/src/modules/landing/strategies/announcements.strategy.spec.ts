import { AnnouncementsStrategy } from './announcements.strategy';

describe('AnnouncementsStrategy', () => {
  const mockPrisma = {
    systemAnnouncement: {
      findMany: jest.fn(),
    },
    programAnnouncement: {
      findMany: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockLandingSnapshotService = {
    getOrBuildAnnouncementsSnapshot: jest.fn(async (_brand: unknown, build: () => Promise<unknown>) => build()),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheService.get.mockResolvedValue(undefined);
    mockCacheService.set.mockResolvedValue(undefined);
  });

  it('merges public program announcements into the landing announcements feed', async () => {
    const strategy = new AnnouncementsStrategy(
      mockPrisma as never,
      mockCacheService as never,
      mockLandingSnapshotService as never,
    );

    mockPrisma.systemAnnouncement.findMany.mockResolvedValue([
      {
        id: 'sys-1',
        title: 'Platform update',
        summary: 'System maintenance tonight',
        content: '<p>Maintenance</p>',
        metadata: { imageUrl: 'https://cdn.example.com/system.png', author: 'YBB Team', tags: ['system'] },
        publishedAt: new Date('2025-02-10T08:00:00.000Z'),
        actionUrl: 'https://status.example.com',
        type: 'maintenance',
      },
    ]);

    mockPrisma.programAnnouncement.findMany.mockResolvedValue([
      {
        id: 'prog-1',
        title: 'Program orientation',
        content: '<p>Orientation details</p>',
        imageUrl: 'https://cdn.example.com/program.png',
        publishDate: new Date('2025-02-12T08:00:00.000Z'),
        category: 'update',
        tags: ['orientation'],
        isPinned: true,
        program: {
          name: 'Youth Summit',
          slug: 'youth-summit',
        },
      },
    ]);

    const result = await strategy.getData({ id: 'brand-1' } as never) as {
      sections: Array<{ type: string; data?: unknown[] }>;
    };
    const listSection = result.sections.find((section) => section.type === 'announcement_list');

    expect(mockPrisma.programAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          targetAudience: 'all',
          publishDate: { lte: expect.any(Date) },
          program: expect.objectContaining({
            brandId: 'brand-1',
            isPublished: true,
            isVisibleToUsers: true,
          }),
        }),
      }),
    );
    expect(listSection?.data).toEqual([
      expect.objectContaining({
        id: 'prog-1',
        title: 'Program orientation',
        author: 'Youth Summit',
        href: '/programs/youth-summit',
      }),
      expect.objectContaining({
        id: 'sys-1',
        title: 'Platform update',
        author: 'YBB Team',
        href: 'https://status.example.com',
      }),
    ]);
  });
});
