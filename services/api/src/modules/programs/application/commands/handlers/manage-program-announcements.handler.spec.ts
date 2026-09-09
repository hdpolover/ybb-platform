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
});
