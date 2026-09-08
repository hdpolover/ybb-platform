// src/modules/reminders/application/services/application-draft-unsubmitted-audience.service.spec.ts
import { ApplicationDraftUnsubmittedAudienceService } from './application-draft-unsubmitted-audience.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function buildRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'app-1',
    status: 'submitted',
    registrationPaymentStatus: 'paid',
    submittedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    participant: {
      id: 'p-1',
      fullName: 'Ada Lovelace',
      user: { id: 'u-1', email: 'ada@example.com' },
    },
    ...over,
  };
}

describe('ApplicationDraftUnsubmittedAudienceService', () => {
  let findMany: jest.Mock;
  let count: jest.Mock;
  let service: ApplicationDraftUnsubmittedAudienceService;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([buildRow()]);
    count = jest.fn().mockResolvedValue(1);
    service = new ApplicationDraftUnsubmittedAudienceService({
      participantApplication: { findMany, count },
    } as unknown as PrismaService);
  });

  describe('buildWhere — what this audience targets', () => {
    it('requires the registration fee to be canonically paid', () => {
      expect(service.buildWhere('prog-1').registrationPaymentStatus).toBe('paid');
    });

    it('requires submittedAt to still be null', () => {
      expect(service.buildWhere('prog-1').submittedAt).toBeNull();
    });

    it('mirrors RegistrationFeeAudienceService: excludes deactivated and soft-deleted accounts', () => {
      const where = service.buildWhere('prog-1');
      expect(where.participant).toEqual({
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      });
      expect(where.deletedAt).toBeNull();
    });

    it('mirrors RegistrationFeeAudienceService: excludes withdrawn and rejected applications', () => {
      expect(service.buildWhere('prog-1').status).toEqual({
        notIn: ['withdrawn', 'rejected'],
      });
    });
  });

  describe('preview', () => {
    it('is always applicable — unlike registration_fee_unpaid, there is no program-level gate', async () => {
      const preview = await service.preview('prog-1');

      expect(preview.applicable).toBe(true);
    });

    it('returns the true total alongside a capped list', async () => {
      count.mockResolvedValue(17); // the verified prod size for this audience
      const preview = await service.preview('prog-1', 2);

      expect(preview.count).toBe(17);
      expect(preview.listLimit).toBe(2);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    });
  });

  describe('findRecipients', () => {
    it('is unbounded — no `take` on the recipient query', async () => {
      await service.findRecipients('prog-1');

      expect(findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ take: expect.anything() }),
      );
    });

    it('never returns the same participant twice', async () => {
      findMany.mockResolvedValue([buildRow(), buildRow({ id: 'app-2' })]);

      const recipients = await service.findRecipients('prog-1');

      expect(recipients).toHaveLength(1);
    });

    it('falls back to a generic salutation when full_name is blank', async () => {
      findMany.mockResolvedValue([
        buildRow({
          participant: { id: 'p-1', fullName: '', user: { id: 'u-1', email: 'ada@example.com' } },
        }),
      ]);

      await expect(service.findRecipients('prog-1')).resolves.toEqual([
        { participantId: 'p-1', userId: 'u-1', email: 'ada@example.com', fullName: 'Participant' },
      ]);
    });
  });
});
