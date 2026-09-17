import {
  CreateProgramAnnouncementHandler,
  UpdateProgramAnnouncementHandler,
  DeleteProgramAnnouncementHandler,
  ListProgramAnnouncementsHandler,
} from './manage-program-announcements.handler';
import {
  CreateProgramAnnouncementCommand,
  UpdateProgramAnnouncementCommand,
  DeleteProgramAnnouncementCommand,
  ListProgramAnnouncementsCommand,
} from '../program-announcement.commands';

const homeAndSettingsOptions = {
  clearSnapshot: true,
  bustProgramCache: true,
  swallowErrors: true,
  revalidate: { kind: 'homeAndSettings' as const },
};

describe('Program announcement handlers', () => {
  const mockPrisma = {
    program: {
      findUnique: jest.fn(),
    },
    programAnnouncement: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockLandingCacheInvalidation = {
    invalidate: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates announcements with the requested publish date and draft status', async () => {
    const handler = new CreateProgramAnnouncementHandler(mockPrisma as never, mockLandingCacheInvalidation as never);
    const publishDate = '2025-03-01T10:30:00.000Z';

    mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-1', brandId: 'brand-1' });
    mockPrisma.programAnnouncement.create.mockResolvedValue({ id: 'announcement-1' });

    await handler.execute(
      new CreateProgramAnnouncementCommand(
        'program-1',
        {
          title: 'Draft announcement',
          content: '<p>Hello</p>',
          publishDate,
          isActive: false,
        },
        'admin-1',
      ),
    );

    expect(mockPrisma.programAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishDate: new Date(publishDate),
          isActive: false,
        }),
      }),
    );
  });

  it('updates announcements with a new publish date', async () => {
    const handler = new UpdateProgramAnnouncementHandler(mockPrisma as never, mockLandingCacheInvalidation as never);
    const publishDate = '2025-03-04T09:00:00.000Z';

    mockPrisma.programAnnouncement.findUnique.mockResolvedValue({ id: 'announcement-1', programId: 'program-1' });
    mockPrisma.programAnnouncement.update.mockResolvedValue({ id: 'announcement-1' });
    mockPrisma.program.findUnique.mockResolvedValue({ brandId: 'brand-1' });

    await handler.execute(
      new UpdateProgramAnnouncementCommand('announcement-1', {
        publishDate,
        isActive: true,
      }, 'admin-1'),
    );

    expect(mockPrisma.programAnnouncement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishDate: new Date(publishDate),
          isActive: true,
        }),
      }),
    );
  });

  // Audit M14: ListProgramAnnouncementsHandler.execute previously built `where`
  // from only programId/category/targetAudience — all client-supplied — with
  // no isActive/publishDate/targetAudience safety net, so an anonymous caller
  // could read unpublished, future-scheduled, or participant-only
  // announcements. The route (@Public + OptionalJwtAuthGuard) now resolves
  // isAdmin server-side and passes it through the command.
  describe('ListProgramAnnouncementsHandler', () => {
    it('forces the live-only filter for a non-admin caller and ignores a client-supplied targetAudience', async () => {
      const handler = new ListProgramAnnouncementsHandler(mockPrisma as never);
      mockPrisma.programAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.programAnnouncement.count.mockResolvedValue(0);

      await handler.execute(
        new ListProgramAnnouncementsCommand(
          'program-1',
          undefined,
          'participants', // attempted bypass: ask for the restricted audience directly
          1,
          20,
          false,
        ),
      );

      const expectedWhere = {
        programId: 'program-1',
        deletedAt: null,
        isActive: true,
        publishDate: { lte: expect.any(Date) },
        targetAudience: 'all',
      };
      expect(mockPrisma.programAnnouncement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.programAnnouncement.count).toHaveBeenCalledWith({ where: expectedWhere });
      // The naive "default targetAudience to 'all' only when absent" reading
      // of the audit fix would have let this explicit value through:
      expect(mockPrisma.programAnnouncement.findMany.mock.calls[0][0].where.targetAudience).not.toBe(
        'participants',
      );
    });

    it('lets an admin caller see drafts, future-scheduled and audience-restricted announcements', async () => {
      const handler = new ListProgramAnnouncementsHandler(mockPrisma as never);
      mockPrisma.programAnnouncement.findMany.mockResolvedValue([]);
      mockPrisma.programAnnouncement.count.mockResolvedValue(0);

      await handler.execute(
        new ListProgramAnnouncementsCommand(
          'program-1',
          undefined,
          'participants',
          1,
          20,
          true,
        ),
      );

      const expectedWhere = {
        programId: 'program-1',
        deletedAt: null,
        targetAudience: 'participants',
      };
      expect(mockPrisma.programAnnouncement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      // No isActive/publishDate filter forced on the admin path.
      expect(mockPrisma.programAnnouncement.findMany.mock.calls[0][0].where.isActive).toBeUndefined();
      expect(mockPrisma.programAnnouncement.findMany.mock.calls[0][0].where.publishDate).toBeUndefined();
    });
  });

  // Audit: AnnouncementsStrategy (landing/strategies/announcements.strategy.ts)
  // reads programAnnouncement directly for the public news feed, but these
  // handlers never cleared any cache layer at all, so a new/edited/removed
  // announcement stayed invisible (or stuck) until the TTL lapsed.
  describe('landing cache invalidation', () => {
    it('CreateProgramAnnouncementHandler invalidates via the shared service with the home+settings hook', async () => {
      const handler = new CreateProgramAnnouncementHandler(mockPrisma as never, mockLandingCacheInvalidation as never);
      mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-1', brandId: 'brand-77' });
      mockPrisma.programAnnouncement.create.mockResolvedValue({ id: 'announcement-1' });

      await handler.execute(
        new CreateProgramAnnouncementCommand(
          'program-1',
          { title: 'News', content: '<p>Hi</p>' },
          'admin-1',
        ),
      );

      expect(mockLandingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-77', homeAndSettingsOptions);
    });

    it('UpdateProgramAnnouncementHandler invalidates via the shared service with the home+settings hook', async () => {
      const handler = new UpdateProgramAnnouncementHandler(mockPrisma as never, mockLandingCacheInvalidation as never);
      mockPrisma.programAnnouncement.findUnique.mockResolvedValue({ id: 'announcement-1', programId: 'program-1' });
      mockPrisma.programAnnouncement.update.mockResolvedValue({ id: 'announcement-1' });
      mockPrisma.program.findUnique.mockResolvedValue({ brandId: 'brand-88' });

      await handler.execute(
        new UpdateProgramAnnouncementCommand('announcement-1', { title: 'Updated' }, 'admin-1'),
      );

      expect(mockLandingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-88', homeAndSettingsOptions);
    });

    it('DeleteProgramAnnouncementHandler invalidates via the shared service with the home+settings hook', async () => {
      const handler = new DeleteProgramAnnouncementHandler(mockPrisma as never, mockLandingCacheInvalidation as never);
      mockPrisma.programAnnouncement.findUnique.mockResolvedValue({ id: 'announcement-1', programId: 'program-1' });
      mockPrisma.programAnnouncement.delete.mockResolvedValue({ id: 'announcement-1' });
      mockPrisma.program.findUnique.mockResolvedValue({ brandId: 'brand-99' });

      await handler.execute(new DeleteProgramAnnouncementCommand('announcement-1', 'admin-1'));

      expect(mockPrisma.programAnnouncement.delete).toHaveBeenCalledWith({ where: { id: 'announcement-1' } });
      expect(mockLandingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-99', homeAndSettingsOptions);
    });
  });

  describe('slugs', () => {
    const uniqueViolation = (fields: string[] = ['slug']) =>
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: fields },
      });

    const takenSlugs = (...slugs: string[]) => {
      mockPrisma.programAnnouncement.count.mockImplementation(async ({ where }: { where: { slug: string } }) =>
        slugs.includes(where.slug) ? 1 : 0,
      );
    };

    beforeEach(() => {
      mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-1', brandId: 'brand-1' });
      mockPrisma.programAnnouncement.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'a-1', ...data }));
      mockPrisma.programAnnouncement.update.mockImplementation(async ({ data }: { data: object }) => ({ id: 'a-1', ...data }));
    });

    const create = (dto: { title: string; slug?: string }) =>
      new CreateProgramAnnouncementHandler(mockPrisma as never, mockLandingCacheInvalidation as never).execute(
        new CreateProgramAnnouncementCommand('program-1', { content: '<p>x</p>', ...dto }, 'admin-1'),
      );

    const update = (dto: { title?: string; slug?: string }) =>
      new UpdateProgramAnnouncementHandler(mockPrisma as never, mockLandingCacheInvalidation as never).execute(
        new UpdateProgramAnnouncementCommand('a-1', dto, 'admin-1'),
      );

    it('generates the slug from the title on create', async () => {
      takenSlugs();
      await create({ title: 'Kwon Hae-suk Explores AI for Inclusive Global Communities' });
      expect(mockPrisma.programAnnouncement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'kwon-hae-suk-explores-ai-for-inclusive-global-communities' }),
      });
    });

    it('suffixes a generated slug that is already taken', async () => {
      takenSlugs('big-news', 'big-news-2');
      await create({ title: 'Big News' });
      expect(mockPrisma.programAnnouncement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'big-news-3' }),
      });
    });

    // PrismaService's soft-delete extension adds deletedAt: null to findFirst
    // but not to count(), and the unique index covers soft-deleted rows. A
    // findFirst-based check would hand out a deleted row's slug and 500 on insert.
    it('checks availability with count() and no deletedAt filter, so soft-deleted rows still hold their slug', async () => {
      takenSlugs();
      await create({ title: 'Big News' });
      expect(mockPrisma.programAnnouncement.count).toHaveBeenCalledWith({ where: { slug: 'big-news' } });
    });

    it('falls back to announcement-<8 chars> when the title has no Latin letters or digits', async () => {
      takenSlugs();
      await create({ title: '한국 청년 서밋' });
      const { data } = mockPrisma.programAnnouncement.create.mock.calls[0][0];
      expect(data.slug).toMatch(/^announcement-[0-9a-f]{8}$/);
    });

    it('uses an explicit slug verbatim', async () => {
      takenSlugs();
      await create({ title: 'Anything', slug: 'my-custom-slug' });
      expect(mockPrisma.programAnnouncement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'my-custom-slug' }),
      });
    });

    it('409s on an explicit slug that is taken, instead of silently suffixing it', async () => {
      takenSlugs('my-custom-slug');
      await expect(create({ title: 'Anything', slug: 'my-custom-slug' })).rejects.toMatchObject({ status: 409 });
      expect(mockPrisma.programAnnouncement.create).not.toHaveBeenCalled();
    });

    it('409s when an explicit slug loses a race at the unique index', async () => {
      takenSlugs();
      mockPrisma.programAnnouncement.create.mockRejectedValueOnce(uniqueViolation());
      await expect(create({ title: 'Anything', slug: 'my-custom-slug' })).rejects.toMatchObject({ status: 409 });
    });

    it('retries a generated slug that loses a race at the unique index', async () => {
      const taken: string[] = [];
      mockPrisma.programAnnouncement.count.mockImplementation(async ({ where }: { where: { slug: string } }) =>
        taken.includes(where.slug) ? 1 : 0,
      );
      mockPrisma.programAnnouncement.create.mockImplementationOnce(async () => {
        taken.push('big-news'); // the other admin's insert landed first
        throw uniqueViolation();
      });

      await create({ title: 'Big News' });

      expect(mockPrisma.programAnnouncement.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.programAnnouncement.create.mock.calls[1][0].data.slug).toBe('big-news-2');
    });

    it('does not swallow unique violations on other columns', async () => {
      takenSlugs();
      mockPrisma.programAnnouncement.create.mockRejectedValue(uniqueViolation(['legacy_id']));
      await expect(create({ title: 'Big News' })).rejects.toMatchObject({ code: 'P2002' });
      expect(mockPrisma.programAnnouncement.create).toHaveBeenCalledTimes(1);
    });

    it('never changes the slug when only the title is edited', async () => {
      mockPrisma.programAnnouncement.findUnique.mockResolvedValue({ id: 'a-1', programId: 'program-1', slug: 'old-slug' });
      await update({ title: 'A Completely Different Title' });
      const { data } = mockPrisma.programAnnouncement.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('slug');
      expect(mockPrisma.programAnnouncement.count).not.toHaveBeenCalled();
    });

    it('does not re-check or rewrite an unchanged slug', async () => {
      mockPrisma.programAnnouncement.findUnique.mockResolvedValue({ id: 'a-1', programId: 'program-1', slug: 'old-slug' });
      await update({ slug: 'old-slug' });
      expect(mockPrisma.programAnnouncement.update.mock.calls[0][0].data).not.toHaveProperty('slug');
      expect(mockPrisma.programAnnouncement.count).not.toHaveBeenCalled();
    });

    it('changes the slug when a different one is provided, excluding this row from the check', async () => {
      mockPrisma.programAnnouncement.findUnique.mockResolvedValue({ id: 'a-1', programId: 'program-1', slug: 'old-slug' });
      takenSlugs();
      await update({ slug: 'new-slug' });
      expect(mockPrisma.programAnnouncement.count).toHaveBeenCalledWith({
        where: { slug: 'new-slug', id: { not: 'a-1' } },
      });
      expect(mockPrisma.programAnnouncement.update.mock.calls[0][0].data).toEqual({ slug: 'new-slug' });
    });

    it('409s when the new slug belongs to another announcement', async () => {
      mockPrisma.programAnnouncement.findUnique.mockResolvedValue({ id: 'a-1', programId: 'program-1', slug: 'old-slug' });
      takenSlugs('new-slug');
      await expect(update({ slug: 'new-slug' })).rejects.toMatchObject({ status: 409 });
      expect(mockPrisma.programAnnouncement.update).not.toHaveBeenCalled();
    });

    it('409s when the new slug loses a race at the unique index', async () => {
      mockPrisma.programAnnouncement.findUnique.mockResolvedValue({ id: 'a-1', programId: 'program-1', slug: 'old-slug' });
      takenSlugs();
      mockPrisma.programAnnouncement.update.mockRejectedValueOnce(uniqueViolation());
      await expect(update({ slug: 'new-slug' })).rejects.toMatchObject({ status: 409 });
    });
  });
});
