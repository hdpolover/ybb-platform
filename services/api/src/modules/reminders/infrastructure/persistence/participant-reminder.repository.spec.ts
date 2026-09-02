// src/modules/reminders/infrastructure/persistence/participant-reminder.repository.spec.ts
import { ParticipantReminderRepository } from './participant-reminder.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('ParticipantReminderRepository', () => {
  let updateMany: jest.Mock;
  let findUnique: jest.Mock;
  let findMany: jest.Mock;
  let repo: ParticipantReminderRepository;

  beforeEach(() => {
    updateMany = jest.fn().mockResolvedValue({ count: 1 });
    findUnique = jest.fn().mockResolvedValue({ id: 'rem-1' });
    findMany = jest.fn().mockResolvedValue([{ id: 'rem-1' }]);
    repo = new ParticipantReminderRepository({
      participantReminder: { updateMany, findUnique, findMany },
    } as unknown as PrismaService);
  });

  describe('claimForSending', () => {
    it('guards the transition on status = scheduled', async () => {
      await repo.claimForSending('rem-1');

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'rem-1', status: 'scheduled' },
        data: { status: 'sending', dispatchedAt: expect.any(Date) },
      });
    });

    it('returns null when the row was not in `scheduled` — cancelled, or already claimed', async () => {
      updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.claimForSending('rem-1')).resolves.toBeNull();
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('cannot resurrect a reminder stuck in `sending`', async () => {
      // The where clause pins status to 'scheduled', so a crashed mid-send row
      // matches nothing here no matter how often the cron fires.
      updateMany.mockResolvedValue({ count: 0 });
      await expect(repo.claimForSending('rem-1')).resolves.toBeNull();
    });
  });

  describe('cancelIfNotSending', () => {
    it('only cancels a draft or still-scheduled reminder', async () => {
      await repo.cancelIfNotSending('rem-1');

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'rem-1', status: { in: ['draft', 'scheduled'] } },
        data: { status: 'cancelled', cancelledAt: expect.any(Date) },
      });
    });

    it('reports failure rather than pretending an in-flight send was stopped', async () => {
      updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.cancelIfNotSending('rem-1')).resolves.toBeNull();
    });

    it('races the dispatcher deterministically: whichever UPDATE lands first wins', async () => {
      // Cancel first -> status becomes 'cancelled' -> the dispatcher's
      // `WHERE status = 'scheduled'` matches nothing and nothing is sent.
      // Dispatcher first -> status becomes 'sending' -> this matches nothing
      // and the admin is told it is too late. There is no window in which both
      // succeed, because both are single conditional UPDATEs on the same row.
      const cancelWhere = { id: 'rem-1', status: { in: ['draft', 'scheduled'] } };
      await repo.cancelIfNotSending('rem-1');
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: cancelWhere }),
      );
    });
  });

  describe('updateIfEditable', () => {
    it('refuses to edit anything already sending, sent or cancelled', async () => {
      await repo.updateIfEditable('rem-1', { subject: 'New' });

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'rem-1', status: { in: ['draft', 'scheduled'] } },
        data: { subject: 'New' },
      });
    });
  });

  describe('markSent', () => {
    it('closes out only a reminder currently in `sending`', async () => {
      await repo.markSent('rem-1', 0);

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'rem-1', status: 'sending' },
        data: { status: 'sent', sentAt: expect.any(Date), audienceCount: 0 },
      });
    });
  });

  describe('findDueIds', () => {
    it('only ever selects scheduled reminders whose send time has passed', async () => {
      const now = new Date('2026-09-09T01:00:00.000Z');

      await repo.findDueIds(now, 20);

      expect(findMany).toHaveBeenCalledWith({
        where: { status: 'scheduled', scheduledAt: { not: null, lte: now } },
        select: { id: true },
        orderBy: { scheduledAt: 'asc' },
        take: 20,
      });
    });
  });
});
