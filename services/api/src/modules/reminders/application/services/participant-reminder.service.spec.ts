// src/modules/reminders/application/services/participant-reminder.service.spec.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ParticipantReminderService } from './participant-reminder.service';
import { ParticipantReminderRepository } from '../../infrastructure/persistence/participant-reminder.repository';
import { ParticipantReminderSendRepository } from '../../infrastructure/persistence/participant-reminder-send.repository';
import { ReminderAudienceRegistry } from './reminder-audience.registry';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const FUTURE = '2099-01-01T08:00:00+07:00';
const PAST = '2020-01-01T08:00:00+07:00';

function build() {
  const create = jest.fn().mockImplementation(({ ...data }) => ({
    id: 'rem-1',
    dispatchedAt: null,
    sentAt: null,
    cancelledAt: null,
    audienceCount: null,
    createdAt: new Date(),
    ...data,
  }));
  const findById = jest.fn().mockResolvedValue({
    id: 'rem-1',
    programId: 'prog-1',
    audience: 'registration_fee_unpaid',
    subject: 'Subject',
    body: 'Body',
    scheduledAt: new Date(FUTURE),
    status: 'scheduled',
    dispatchedAt: null,
    sentAt: null,
    cancelledAt: null,
    audienceCount: null,
    createdAt: new Date(),
  });
  const cancelIfNotSending = jest.fn().mockResolvedValue({
    ...(findById.mock.results[0]?.value ?? {}),
    id: 'rem-1',
    programId: 'prog-1',
    audience: 'registration_fee_unpaid',
    subject: 'Subject',
    body: 'Body',
    scheduledAt: new Date(FUTURE),
    status: 'cancelled',
    dispatchedAt: null,
    sentAt: null,
    cancelledAt: new Date(),
    audienceCount: null,
    createdAt: new Date(),
  });
  const updateIfEditable = jest.fn().mockResolvedValue(null);
  const findByProgram = jest.fn().mockResolvedValue({ rows: [], total: 0 });

  const audiencePreview = jest.fn().mockResolvedValue({
    applicable: true,
    count: 2,
    members: [{ participantName: 'Ada Lovelace' }],
    listLimit: 200,
  });
  // resolve() always hands back the same stub adapter regardless of which
  // audience is asked for — these tests only exercise the default audience.
  const audienceRegistry = {
    resolve: jest.fn().mockReturnValue({
      preview: audiencePreview,
      findRecipients: jest.fn().mockResolvedValue([]),
    }),
  } as unknown as ReminderAudienceRegistry;

  const service = new ParticipantReminderService(
    {
      program: { findFirst: jest.fn().mockResolvedValue({ name: 'CYS 2026' }) },
      participant: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService,
    {
      create,
      findById,
      cancelIfNotSending,
      updateIfEditable,
      findByProgram,
    } as unknown as ParticipantReminderRepository,
    {
      findByReminder: jest.fn().mockResolvedValue([]),
      summariseByReminderIds: jest.fn().mockResolvedValue([]),
    } as unknown as ParticipantReminderSendRepository,
    audienceRegistry,
  );

  return { service, create, findById, cancelIfNotSending, updateIfEditable, findByProgram, audiencePreview };
}

describe('ParticipantReminderService', () => {
  describe('create', () => {
    it('saves a draft when no send time is given — nothing is scheduled by accident', async () => {
      const { service, create } = build();

      const reminder = await service.create(
        'prog-1',
        { subject: 'S', body: 'B' },
        'admin-1',
      );

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft', scheduledAt: null }),
      );
      expect(reminder.status).toBe('draft');
    });

    it('schedules when a future send time is given', async () => {
      const { service, create } = build();

      await service.create('prog-1', { subject: 'S', body: 'B', scheduledAt: FUTURE }, 'a');

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'scheduled', scheduledAt: new Date(FUTURE) }),
      );
    });

    it('rejects a send time in the past — it would fire on the very next tick', async () => {
      const { service } = build();

      await expect(
        service.create('prog-1', { subject: 'S', body: 'B', scheduledAt: PAST }, 'a'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('cancels a scheduled reminder', async () => {
      const { service, cancelIfNotSending } = build();

      const cancelled = await service.cancel('prog-1', 'rem-1');

      expect(cancelIfNotSending).toHaveBeenCalledWith('rem-1');
      expect(cancelled.status).toBe('cancelled');
    });

    it('409s rather than reporting success once the dispatcher has claimed it', async () => {
      const { service, cancelIfNotSending } = build();
      cancelIfNotSending.mockResolvedValue(null);

      await expect(service.cancel('prog-1', 'rem-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('refuses to touch a reminder belonging to another program', async () => {
      const { service, findById } = build();
      findById.mockResolvedValue({ id: 'rem-1', programId: 'other-program' });

      await expect(service.cancel('prog-1', 'rem-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('409s when the reminder was claimed between the read and the write', async () => {
      const { service } = build();

      await expect(
        service.update('prog-1', 'rem-1', { subject: 'New' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to edit a reminder that has already sent', async () => {
      const { service, findById } = build();
      findById.mockResolvedValue({
        id: 'rem-1',
        programId: 'prog-1',
        status: 'sent',
        scheduledAt: new Date(FUTURE),
      });

      await expect(
        service.update('prog-1', 'rem-1', { subject: 'New' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns a scheduled reminder to draft when scheduledAt is explicitly null', async () => {
      const { service, updateIfEditable } = build();
      updateIfEditable.mockResolvedValue({
        id: 'rem-1',
        programId: 'prog-1',
        audience: 'registration_fee_unpaid',
        subject: 'S',
        body: 'B',
        scheduledAt: null,
        status: 'draft',
        dispatchedAt: null,
        sentAt: null,
        cancelledAt: null,
        audienceCount: null,
        createdAt: new Date(),
      });

      await service.update('prog-1', 'rem-1', { scheduledAt: null });

      expect(updateIfEditable).toHaveBeenCalledWith('rem-1', {
        scheduledAt: null,
        status: 'draft',
      });
    });

    it('leaves the schedule untouched when scheduledAt is omitted', async () => {
      const { service, updateIfEditable } = build();
      updateIfEditable.mockResolvedValue({
        id: 'rem-1',
        programId: 'prog-1',
        audience: 'registration_fee_unpaid',
        subject: 'New',
        body: 'B',
        scheduledAt: new Date(FUTURE),
        status: 'scheduled',
        dispatchedAt: null,
        sentAt: null,
        cancelledAt: null,
        audienceCount: null,
        createdAt: new Date(),
      });

      await service.update('prog-1', 'rem-1', { subject: 'New' });

      expect(updateIfEditable).toHaveBeenCalledWith('rem-1', { subject: 'New' });
    });
  });

  describe('previewMessage', () => {
    it('renders tokens against a real member so the admin reads what a participant will', async () => {
      const { service } = build();

      const result = await service.previewMessage(
        'prog-1',
        'Fee for {{program_name}}',
        'Hi {{participant_name}}, please pay.',
      );

      expect(result.preview).toEqual({
        subject: 'Fee for CYS 2026',
        body: 'Hi Ada Lovelace, please pay.',
      });
      expect(result.count).toBe(2);
    });
  });

  describe('previewAudience', () => {
    it('rejects an audience that is not one of REMINDER_AUDIENCE_VALUES', async () => {
      const { service } = build();

      await expect(service.previewAudience('prog-1', 'not_a_real_audience')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('resolves the requested audience via the registry, not a hardcoded default', async () => {
      const { service, audiencePreview } = build();

      await service.previewAudience('prog-1', 'program_fee_unpaid');

      expect(audiencePreview).toHaveBeenCalledWith('prog-1');
    });

    it('attaches the overlap note only for audiences that have one', async () => {
      const { service } = build();

      const draftUnsubmitted = await service.previewAudience('prog-1', 'application_draft_unsubmitted');
      const registrationFee = await service.previewAudience('prog-1', 'registration_fee_unpaid');

      expect(draftUnsubmitted.overlapNote).toEqual(expect.stringContaining('automated'));
      expect(registrationFee.overlapNote).toBeNull();
    });
  });

  describe('list', () => {
    it('returns the pagination meta the admin dashboard reads', async () => {
      const { service, findByProgram } = build();
      findByProgram.mockResolvedValue({ rows: [], total: 47 });

      const result = await service.list('prog-1', { page: 2, limit: 10 });

      expect(result.meta).toEqual({ total: 47, page: 2, limit: 10, totalPages: 5 });
      expect(findByProgram).toHaveBeenCalledWith('prog-1', {
        page: 2,
        limit: 10,
        status: undefined,
        search: undefined,
      });
    });

    it('defaults to page 1 / limit 20 and clamps limit to 100', async () => {
      const { service, findByProgram } = build();

      await service.list('prog-1', { limit: 500 });

      expect(findByProgram).toHaveBeenCalledWith(
        'prog-1',
        expect.objectContaining({ page: 1, limit: 100 }),
      );
    });

    it('falls back to page 1 on a malformed page value rather than propagating NaN', async () => {
      const { service, findByProgram } = build();

      await service.list('prog-1', { page: Number('not-a-number') });

      expect(findByProgram).toHaveBeenCalledWith(
        'prog-1',
        expect.objectContaining({ page: 1 }),
      );
    });

    it('passes a valid status filter through untouched', async () => {
      const { service, findByProgram } = build();

      await service.list('prog-1', { status: 'scheduled' });

      expect(findByProgram).toHaveBeenCalledWith(
        'prog-1',
        expect.objectContaining({ status: 'scheduled' }),
      );
    });

    it('drops a status value that is not a real reminder status, rather than erroring', async () => {
      const { service, findByProgram } = build();

      await service.list('prog-1', { status: 'bogus' });

      expect(findByProgram).toHaveBeenCalledWith(
        'prog-1',
        expect.objectContaining({ status: undefined }),
      );
    });

    it('trims whitespace-only search to undefined', async () => {
      const { service, findByProgram } = build();

      await service.list('prog-1', { search: '   ' });

      expect(findByProgram).toHaveBeenCalledWith(
        'prog-1',
        expect.objectContaining({ search: undefined }),
      );
    });
  });
});
