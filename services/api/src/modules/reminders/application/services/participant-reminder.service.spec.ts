// src/modules/reminders/application/services/participant-reminder.service.spec.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ParticipantReminderService } from './participant-reminder.service';
import { ParticipantReminderRepository } from '../../infrastructure/persistence/participant-reminder.repository';
import { ParticipantReminderSendRepository } from '../../infrastructure/persistence/participant-reminder-send.repository';
import { RegistrationFeeAudienceService } from './registration-fee-audience.service';
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
      findByProgram: jest.fn().mockResolvedValue([]),
    } as unknown as ParticipantReminderRepository,
    {
      findByReminder: jest.fn().mockResolvedValue([]),
      summariseByReminderIds: jest.fn().mockResolvedValue([]),
    } as unknown as ParticipantReminderSendRepository,
    {
      preview: jest.fn().mockResolvedValue({
        registrationFeeConfigured: true,
        count: 2,
        members: [{ participantName: 'Ada Lovelace' }],
        listLimit: 200,
      }),
    } as unknown as RegistrationFeeAudienceService,
  );

  return { service, create, findById, cancelIfNotSending, updateIfEditable };
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
});
