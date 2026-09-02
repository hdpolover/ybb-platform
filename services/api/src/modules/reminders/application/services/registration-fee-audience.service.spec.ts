// src/modules/reminders/application/services/registration-fee-audience.service.spec.ts
import { RegistrationFeeAudienceService } from './registration-fee-audience.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function buildRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'app-1',
    status: 'draft',
    registrationPaymentStatus: 'unpaid',
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

describe('RegistrationFeeAudienceService', () => {
  let findFirst: jest.Mock;
  let findMany: jest.Mock;
  let count: jest.Mock;
  let service: RegistrationFeeAudienceService;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue({ id: 'tier-1' });
    findMany = jest.fn().mockResolvedValue([buildRow()]);
    count = jest.fn().mockResolvedValue(1);
    service = new RegistrationFeeAudienceService({
      programPricingTier: { findFirst },
      participantApplication: { findMany, count },
    } as unknown as PrismaService);
  });

  describe('buildWhere — what "unpaid" means', () => {
    it('does NOT require an invoice to exist, because invoices are minted lazily', () => {
      const where = service.buildWhere('prog-1');

      // The critical assertion for this whole feature. A freshly-registered
      // participant who owes the fee has NO invoice row at all, so any
      // predicate demanding one (`invoices: { some: ... }`) would silently
      // exclude exactly the people the reminder exists for.
      expect(where.invoices).toEqual({
        none: {
          status: { in: ['paid', 'processing'] },
          pricingTier: { feeType: 'registration_fee' },
        },
      });
      expect(JSON.stringify(where)).not.toContain('"some"');
    });

    it('excludes anyone whose canonical registration status is already paid', () => {
      expect(service.buildWhere('prog-1').registrationPaymentStatus).toEqual({
        not: 'paid',
      });
    });

    it('excludes an in-flight (processing) registration invoice, not just a paid one', () => {
      // payment.succeeded events are known to drop, leaving genuinely-paid
      // invoices stuck in `processing`, and a manual transfer awaiting admin
      // review also sits there. Mailing "you have not paid" to either is a
      // support incident.
      const statuses = (service.buildWhere('prog-1').invoices as {
        none: { status: { in: string[] } };
      }).none.status.in;
      expect(statuses).toContain('processing');
      expect(statuses).toContain('paid');
    });

    it('excludes deactivated and soft-deleted accounts', () => {
      const where = service.buildWhere('prog-1');
      expect(where.participant).toEqual({
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      });
      expect(where.deletedAt).toBeNull();
    });

    it('excludes withdrawn and rejected applications', () => {
      expect(service.buildWhere('prog-1').status).toEqual({
        notIn: ['withdrawn', 'rejected'],
      });
    });

    it('does not filter by application status beyond the exclusions — a draft owes the fee too', () => {
      // The registration fee gates SUBMISSION, so the typical unpaid person is
      // still in `draft`. Restricting to submitted applications would produce
      // an almost-empty audience.
      expect(service.buildWhere('prog-1').status).not.toHaveProperty('in');
    });
  });

  describe('program-level gate', () => {
    it('reports an empty audience when the program has no active registration_fee tier', async () => {
      findFirst.mockResolvedValue(null);

      const preview = await service.preview('prog-1');

      expect(preview).toEqual({
        registrationFeeConfigured: false,
        count: 0,
        members: [],
        listLimit: 200,
      });
      // Nothing is owed, so no audience query should have run at all.
      expect(count).not.toHaveBeenCalled();
      expect(findMany).not.toHaveBeenCalled();
    });

    it('only considers active, non-deleted registration_fee tiers', async () => {
      await service.hasActiveRegistrationFee('prog-1');

      expect(findFirst).toHaveBeenCalledWith({
        where: {
          programId: 'prog-1',
          isActive: true,
          deletedAt: null,
          feeType: 'registration_fee',
        },
        select: { id: true },
      });
    });

    it('returns no recipients when the program charges no registration fee', async () => {
      findFirst.mockResolvedValue(null);
      await expect(service.findRecipients('prog-1')).resolves.toEqual([]);
    });
  });

  describe('preview', () => {
    it('returns the true total alongside a capped list', async () => {
      count.mockResolvedValue(1234);

      const preview = await service.preview('prog-1', 2);

      expect(preview.count).toBe(1234);
      expect(preview.listLimit).toBe(2);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2, orderBy: { createdAt: 'asc' } }),
      );
    });

    it('falls back to the email address when full_name is still blank', async () => {
      findMany.mockResolvedValue([
        buildRow({
          participant: {
            id: 'p-1',
            fullName: '',
            user: { id: 'u-1', email: 'ada@example.com' },
          },
        }),
      ]);

      const preview = await service.preview('prog-1');

      expect(preview.members[0].participantName).toBe('ada@example.com');
    });

    it('surfaces the submission and payment state an admin needs to sanity-check the list', async () => {
      const preview = await service.preview('prog-1');

      expect(preview.members[0]).toMatchObject({
        applicationId: 'app-1',
        participantId: 'p-1',
        email: 'ada@example.com',
        applicationStatus: 'draft',
        registrationPaymentStatus: 'unpaid',
        submittedAt: null,
      });
    });
  });

  describe('findRecipients', () => {
    it('is unbounded — a send must not silently stop at the preview cap', async () => {
      await service.findRecipients('prog-1');

      expect(findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ take: expect.anything() }),
      );
    });

    it('falls back to a generic salutation when full_name is blank', async () => {
      findMany.mockResolvedValue([
        buildRow({
          participant: {
            id: 'p-1',
            fullName: '',
            user: { id: 'u-1', email: 'ada@example.com' },
          },
        }),
      ]);

      await expect(service.findRecipients('prog-1')).resolves.toEqual([
        {
          participantId: 'p-1',
          userId: 'u-1',
          email: 'ada@example.com',
          fullName: 'Participant',
        },
      ]);
    });

    it('never returns the same participant twice', async () => {
      findMany.mockResolvedValue([buildRow(), buildRow({ id: 'app-2' })]);

      const recipients = await service.findRecipients('prog-1');

      // The send log's unique key is (reminder, participant); a duplicate pair
      // would vanish on insert and leave the recipient count disagreeing with
      // the row count.
      expect(recipients).toHaveLength(1);
    });
  });
});
