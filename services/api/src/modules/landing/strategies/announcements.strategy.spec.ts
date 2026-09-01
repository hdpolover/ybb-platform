import { AnnouncementsStrategy } from './announcements.strategy';

describe('AnnouncementsStrategy', () => {
  const mockPrisma = {
    systemAnnouncement: {
      findMany: jest.fn(),
    },
    programAnnouncement: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    program: {
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
    mockPrisma.programAnnouncement.count.mockResolvedValue(0);
    mockPrisma.program.findMany.mockResolvedValue([]);
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

  describe('pagination', () => {
    function makeProgramFixture(count: number) {
      // Descending publishDate, unique ids — the exact total order the DB
      // query orderBy ([isPinned desc, publishDate desc, id asc]) produces.
      return Array.from({ length: count }, (_, index) => ({
        id: `prog-${String(count - index).padStart(3, '0')}`,
        title: `Announcement ${count - index}`,
        content: '<p>body</p>',
        imageUrl: null,
        publishDate: new Date(Date.UTC(2026, 0, 1, 0, 0, count - index)),
        category: 'News',
        tags: [] as string[],
        isPinned: false,
        program: { name: 'Youth Summit', slug: 'youth-summit' },
      }));
    }

    it('iterating every page yields the full set with no row dropped or duplicated', async () => {
      const fixture = makeProgramFixture(23);
      const limit = 5;

      mockPrisma.systemAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.programAnnouncement.count.mockResolvedValue(fixture.length);
      mockPrisma.programAnnouncement.findMany.mockImplementation((args: { skip?: number; take?: number; select?: unknown }) => {
        if (args.select) {
          // facet sample query
          return Promise.resolve(fixture);
        }
        const skip = args.skip ?? 0;
        const take = args.take ?? fixture.length;
        return Promise.resolve(fixture.slice(skip, skip + take));
      });

      const strategy = new AnnouncementsStrategy(
        mockPrisma as never,
        mockCacheService as never,
        mockLandingSnapshotService as never,
      );

      const totalPages = Math.ceil(fixture.length / limit);
      const seenIds: string[] = [];

      for (let page = 1; page <= totalPages; page += 1) {
        const result = await strategy.getAnnouncements(
          { id: 'brand-1' } as never,
          { page, limit } as never,
        ) as { sections: Array<{ type: string; data?: Array<{ id: string }> }> };
        const listSection = result.sections.find((section) => section.type === 'announcement_list');
        seenIds.push(...(listSection?.data ?? []).map((item) => item.id));
      }

      expect(seenIds).toHaveLength(fixture.length);
      expect(new Set(seenIds).size).toBe(fixture.length);
      expect(seenIds).toEqual(fixture.map((f) => f.id));
    });

    it('uses the snapshot for the default page=1 no-filters request', async () => {
      mockPrisma.systemAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.programAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.programAnnouncement.count.mockResolvedValue(0);

      const strategy = new AnnouncementsStrategy(
        mockPrisma as never,
        mockCacheService as never,
        mockLandingSnapshotService as never,
      );

      await strategy.getAnnouncements({ id: 'brand-1' } as never, {} as never);

      expect(mockLandingSnapshotService.getOrBuildAnnouncementsSnapshot).toHaveBeenCalledTimes(1);
      expect(mockCacheService.get).not.toHaveBeenCalled();
    });

    it('bypasses the snapshot and uses the filtered cache once page/filters are set', async () => {
      mockPrisma.systemAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.programAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.programAnnouncement.count.mockResolvedValue(0);

      const strategy = new AnnouncementsStrategy(
        mockPrisma as never,
        mockCacheService as never,
        mockLandingSnapshotService as never,
      );

      await strategy.getAnnouncements({ id: 'brand-1' } as never, { page: 2 } as never);

      expect(mockLandingSnapshotService.getOrBuildAnnouncementsSnapshot).not.toHaveBeenCalled();
      expect(mockCacheService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('filters', () => {
    beforeEach(() => {
      mockPrisma.systemAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.programAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.programAnnouncement.count.mockResolvedValue(0);
    });

    it('applies a case-insensitive category filter', async () => {
      const strategy = new AnnouncementsStrategy(
        mockPrisma as never,
        mockCacheService as never,
        mockLandingSnapshotService as never,
      );

      await strategy.getAnnouncements({ id: 'brand-1' } as never, { category: 'news' } as never);

      expect(mockPrisma.programAnnouncement.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { equals: 'news', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('applies a tag filter via hasSome', async () => {
      const strategy = new AnnouncementsStrategy(
        mockPrisma as never,
        mockCacheService as never,
        mockLandingSnapshotService as never,
      );

      await strategy.getAnnouncements({ id: 'brand-1' } as never, { tag: 'orientation' } as never);

      expect(mockPrisma.programAnnouncement.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: { hasSome: ['orientation'] },
          }),
        }),
      );
    });

    it('applies a programId filter', async () => {
      const strategy = new AnnouncementsStrategy(
        mockPrisma as never,
        mockCacheService as never,
        mockLandingSnapshotService as never,
      );

      await strategy.getAnnouncements({ id: 'brand-1' } as never, { programId: 'program-xyz' } as never);

      expect(mockPrisma.programAnnouncement.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            program: expect.objectContaining({ id: 'program-xyz', brandId: 'brand-1' }),
          }),
        }),
      );
    });

    it('applies a search filter across title/content', async () => {
      const strategy = new AnnouncementsStrategy(
        mockPrisma as never,
        mockCacheService as never,
        mockLandingSnapshotService as never,
      );

      await strategy.getAnnouncements({ id: 'brand-1' } as never, { search: 'orientation' } as never);

      expect(mockPrisma.programAnnouncement.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'orientation', mode: 'insensitive' } },
              { content: { contains: 'orientation', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('applies a year filter as a publishDate range', async () => {
      const strategy = new AnnouncementsStrategy(
        mockPrisma as never,
        mockCacheService as never,
        mockLandingSnapshotService as never,
      );

      await strategy.getAnnouncements({ id: 'brand-1' } as never, { year: 2026 } as never);

      expect(mockPrisma.programAnnouncement.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publishDate: {
              lte: expect.any(Date),
              gte: new Date(Date.UTC(2026, 0, 1)),
              lt: new Date(Date.UTC(2027, 0, 1)),
            },
          }),
        }),
      );
    });
  });
});
