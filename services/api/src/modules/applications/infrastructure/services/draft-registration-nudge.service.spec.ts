// src/modules/applications/infrastructure/services/draft-registration-nudge.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  DraftRegistrationNudgeService,
  DRAFT_NUDGE_CUTOFF,
  buildCandidateWhere,
} from './draft-registration-nudge.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { CronLockService } from '@shared/infrastructure/database/cron-lock.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const makeCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  program: {
    name: 'China Youth Summit 2027',
    brandId: 'brand-1',
    applicationDeadline: new Date('2027-10-30T00:00:00Z'),
    contactEmail: 'contact@example.com',
    contactAddress: null,
    brand: {
      name: 'CYS',
      primaryColor: '#000',
      logoUrl: null,
      websiteUrl: null,
      landingUrl: 'https://cys.example.com',
      socialMediaLinks: {},
      settings: { footerNavigation: {}, supportEmail: 'support@example.com' },
    },
  },
  participant: { fullName: 'Jane Doe', user: { email: 'jane@example.com' } },
  ...overrides,
});

describe('DraftRegistrationNudgeService', () => {
  let service: DraftRegistrationNudgeService;
  let mockPrisma: {
    participantApplication: { findMany: jest.Mock; updateMany: jest.Mock };
  };
  let mockRabbitmq: { emit: jest.Mock };
  let runExclusive: jest.Mock;

  // 09:00 WIB on 15 Sep 2027 = 02:00 UTC (a send window).
  const now = new Date('2027-09-15T02:00:00Z');

  beforeEach(async () => {
    mockPrisma = {
      participantApplication: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockRabbitmq = { emit: jest.fn().mockResolvedValue(true) };
    runExclusive = jest.fn((_job: string, fn: () => Promise<void>) => fn());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftRegistrationNudgeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQProducerService, useValue: mockRabbitmq },
        { provide: CronLockService, useValue: { runExclusive } },
      ],
    }).compile();

    service = module.get(DraftRegistrationNudgeService);
  });

  afterEach(() => {
    delete process.env.DRAFT_NUDGE_ENABLED;
  });

  describe('eligibility (where clause)', () => {
    it('is forward-only: bounded below by the hard cutoff, excludes legacy and deleted rows', () => {
      const where = buildCandidateWhere(1, now);

      expect(where.createdAt).toMatchObject({ gte: DRAFT_NUDGE_CUTOFF });
      expect(DRAFT_NUDGE_CUTOFF.toISOString()).toBe('2026-11-13T17:00:00.000Z');
      expect(where.legacyId).toBeNull();
      expect(where.deletedAt).toBeNull();
      expect(where.status).toBe('draft');
    });

    it('requires an active participant with a verified email', () => {
      const where = buildCandidateWhere(1, now);

      expect(where.participant).toEqual({
        deletedAt: null,
        user: { isActive: true, deletedAt: null, emailVerified: true },
      });
    });

    it('excludes any application with a paid or processing invoice, allowing unpaid/failed/cancelled/none', () => {
      const where = buildCandidateWhere(1, now);

      expect(where.invoices).toEqual({ none: { status: { in: ['paid', 'processing'] } } });
      expect(where.registrationPaymentStatus).toEqual({ notIn: ['paid', 'processing'] });
    });

    it('gates on allow_registration and a deadline that has not passed (WIB day)', () => {
      const where = buildCandidateWhere(1, now);

      // 15 Sep 2027 00:00 WIB = 14 Sep 17:00 UTC: a deadline anywhere on today's WIB day still counts.
      expect(where.program).toEqual({
        allowRegistration: true,
        applicationDeadline: { gte: new Date('2027-09-14T17:00:00Z') },
      });
    });

    it('nudge 1 needs no prior nudge; nudge 2 needs nudge 1 sent at least a day ago', () => {
      const w1 = buildCandidateWhere(1, now);
      const w2 = buildCandidateWhere(2, now);

      expect(w1.draftNudge1SentAt).toBeNull();
      expect(w1.draftNudge2SentAt).toBeNull();
      expect(w2.draftNudge1SentAt).toEqual({ not: null, lte: new Date(now.getTime() - DAY_MS) });
      expect(w2.draftNudge2SentAt).toBeNull();
    });

    it('queries nudge 2 before nudge 1, oldest first, capped', async () => {
      await service.sendDueNudges(now);

      const calls = mockPrisma.participantApplication.findMany.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0].where.draftNudge1SentAt).toMatchObject({ not: null });
      expect(calls[1][0].where.draftNudge1SentAt).toBeNull();
      expect(calls[0][0].orderBy).toEqual({ createdAt: 'asc' });
      expect(calls[0][0].take).toBe(100);
    });
  });

  describe('due time / WIB 09:00 window', () => {
    it('at 09:00 WIB, nudge 1 covers applications created up to exactly 2 days earlier', () => {
      const where = buildCandidateWhere(1, now);
      expect((where.createdAt as { lte: Date }).lte).toEqual(new Date('2027-09-13T02:00:00Z'));
    });

    it('at 08:00 WIB the bound is still the previous 09:00 (nothing becomes due mid-window)', () => {
      const eightAmWib = new Date('2027-09-15T01:00:00Z');
      const where = buildCandidateWhere(1, eightAmWib);
      expect((where.createdAt as { lte: Date }).lte).toEqual(new Date('2027-09-12T02:00:00Z'));
    });

    it('does not move the bound between 09:00 and 23:59 WIB', () => {
      const afternoon = new Date('2027-09-15T08:30:00Z'); // 15:30 WIB
      const where = buildCandidateWhere(1, afternoon);
      expect((where.createdAt as { lte: Date }).lte).toEqual(new Date('2027-09-13T02:00:00Z'));
    });

    it('nudge 2 is due 7 days after creation, same window', () => {
      const where = buildCandidateWhere(2, now);
      expect((where.createdAt as { lte: Date }).lte).toEqual(new Date('2027-09-08T02:00:00Z'));
    });
  });

  describe('claim and send', () => {
    it('claims BEFORE emitting, and emits notification.draft_nudge with a deterministic messageId', async () => {
      mockPrisma.participantApplication.findMany
        .mockResolvedValueOnce([]) // nudge 2
        .mockResolvedValueOnce([makeCandidate()]); // nudge 1

      const report = await service.sendDueNudges(now);

      expect(report).toMatchObject({ scanned: 1, sent: 1, errors: 0 });
      expect(mockPrisma.participantApplication.updateMany).toHaveBeenCalledWith({
        where: { id: 'app-1', draftNudge1SentAt: null, draftNudge2SentAt: null },
        data: { draftNudge1SentAt: expect.any(Date) },
      });
      const claimOrder = mockPrisma.participantApplication.updateMany.mock.invocationCallOrder[0];
      const emitOrder = mockRabbitmq.emit.mock.invocationCallOrder[0];
      expect(claimOrder).toBeLessThan(emitOrder);

      expect(mockRabbitmq.emit).toHaveBeenCalledWith(
        'notification.draft_nudge',
        expect.objectContaining({
          email: 'jane@example.com',
          customer_name: 'Jane Doe',
          program_name: 'China Youth Summit 2027',
          application_id: 'app-1',
          nudge_number: 1,
          submission_url: 'https://cys.example.com/dashboard/submission',
          deadline: '2027-10-30T00:00:00.000Z',
          brand: expect.objectContaining({ name: 'CYS' }),
        }),
        { messageId: 'draft_nudge:app-1:1' },
      );
    });

    it('nudge 2 claim requires nudge 1 to be stamped, and writes draftNudge2SentAt', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([makeCandidate()]);

      await service.sendDueNudges(now);

      expect(mockPrisma.participantApplication.updateMany).toHaveBeenCalledWith({
        where: { id: 'app-1', draftNudge1SentAt: { not: null }, draftNudge2SentAt: null },
        data: { draftNudge2SentAt: expect.any(Date) },
      });
      expect(mockRabbitmq.emit.mock.calls[0][2]).toEqual({ messageId: 'draft_nudge:app-1:2' });
      expect(mockRabbitmq.emit.mock.calls[0][1].nudge_number).toBe(2);
    });

    it('does not emit when the claim matches 0 rows (another replica or tick won)', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([makeCandidate()]);
      mockPrisma.participantApplication.updateMany.mockResolvedValueOnce({ count: 0 });

      const report = await service.sendDueNudges(now);

      expect(mockRabbitmq.emit).not.toHaveBeenCalled();
      expect(report.notClaimed).toBe(1);
      expect(report.sent).toBe(0);
    });

    it('skips (no claim, no emit) when the program deadline has passed at send time', async () => {
      const past = makeCandidate({
        program: { ...makeCandidate().program, applicationDeadline: new Date('2027-09-14T00:00:00Z') },
      });
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([past]);

      const report = await service.sendDueNudges(now);

      expect(report.skipped).toBe(1);
      expect(mockPrisma.participantApplication.updateMany).not.toHaveBeenCalled();
      expect(mockRabbitmq.emit).not.toHaveBeenCalled();
    });

    it('skips a candidate with no email without claiming it', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([
        makeCandidate({ participant: { fullName: '', user: { email: null } } }),
      ]);

      const report = await service.sendDueNudges(now);

      expect(report.skipped).toBe(1);
      expect(mockPrisma.participantApplication.updateMany).not.toHaveBeenCalled();
    });

    it('passes an empty full_name through untouched (notification renders the "there" fallback)', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([
        makeCandidate({ participant: { fullName: '', user: { email: 'jane@example.com' } } }),
      ]);

      await service.sendDueNudges(now);

      expect(mockRabbitmq.emit.mock.calls[0][1].customer_name).toBe('');
    });

    it('counts a failed emit as an error and keeps going', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([
        makeCandidate({ id: 'a' }),
        makeCandidate({ id: 'b' }),
      ]);
      mockRabbitmq.emit.mockRejectedValueOnce(new Error('broker down'));

      const report = await service.sendDueNudges(now);

      expect(report.errors).toBe(1);
      expect(report.sent).toBe(1);
    });
  });

  describe('scheduled run / kill switch', () => {
    it('runs under the cron lock by default', async () => {
      await service.runScheduledNudges();

      expect(runExclusive).toHaveBeenCalledWith('draft-registration-nudge', expect.any(Function));
      expect(mockPrisma.participantApplication.findMany).toHaveBeenCalled();
    });

    it.each(['false', '0', 'off'])('does nothing when DRAFT_NUDGE_ENABLED=%s', async (value) => {
      process.env.DRAFT_NUDGE_ENABLED = value;

      await service.runScheduledNudges();

      expect(runExclusive).not.toHaveBeenCalled();
      expect(mockPrisma.participantApplication.findMany).not.toHaveBeenCalled();
    });

    it('stays on when DRAFT_NUDGE_ENABLED=true', async () => {
      process.env.DRAFT_NUDGE_ENABLED = 'true';

      await service.runScheduledNudges();

      expect(runExclusive).toHaveBeenCalled();
    });
  });
});
