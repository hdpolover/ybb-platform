import {
  CreateProgramAnnouncementHandler,
  UpdateProgramAnnouncementHandler,
} from './manage-program-announcements.handler';
import {
  CreateProgramAnnouncementCommand,
  UpdateProgramAnnouncementCommand,
} from '../program-announcement.commands';

describe('Program announcement handlers', () => {
  const mockPrisma = {
    program: {
      findUnique: jest.fn(),
    },
    programAnnouncement: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates announcements with the requested publish date and draft status', async () => {
    const handler = new CreateProgramAnnouncementHandler(mockPrisma as never);
    const publishDate = '2025-03-01T10:30:00.000Z';

    mockPrisma.program.findUnique.mockResolvedValue({ id: 'program-1' });
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
    const handler = new UpdateProgramAnnouncementHandler(mockPrisma as never);
    const publishDate = '2025-03-04T09:00:00.000Z';

    mockPrisma.programAnnouncement.findUnique.mockResolvedValue({ id: 'announcement-1' });
    mockPrisma.programAnnouncement.update.mockResolvedValue({ id: 'announcement-1' });

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
});
