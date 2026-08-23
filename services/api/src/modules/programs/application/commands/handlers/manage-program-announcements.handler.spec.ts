import {
  CreateProgramAnnouncementHandler,
  UpdateProgramAnnouncementHandler,
  DeleteProgramAnnouncementHandler,
} from './manage-program-announcements.handler';
import {
  CreateProgramAnnouncementCommand,
  UpdateProgramAnnouncementCommand,
  DeleteProgramAnnouncementCommand,
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
      update: jest.fn(),
      delete: jest.fn(),
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
