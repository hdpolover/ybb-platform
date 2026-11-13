// src/modules/applications/infrastructure/services/funding-result-email.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { FundingResultEmailService, buildCandidateWhere } from './funding-result-email.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { CronLockService } from '@shared/infrastructure/database/cron-lock.service';

const makeCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  fundingDecision: 'awarded',
  program: {
    name: 'China Youth Summit 2027',
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

describe('FundingResultEmailService', () => {
  let service: FundingResultEmailService;
  let mockPrisma: { participantApplication: { findMany: jest.Mock; updateMany: jest.Mock } };
  let mockRabbitmq: { emit: jest.Mock };
  let runExclusive: jest.Mock;

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
        FundingResultEmailService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQProducerService, useValue: mockRabbitmq },
        { provide: CronLockService, useValue: { runExclusive } },
      ],
    }).compile();

    service = module.get(FundingResultEmailService);
  });

  afterEach(() => {
    delete process.env.FUNDING_RESULT_EMAIL_ENABLED;
  });

  describe('eligibility (where clause)', () => {
    it('requires a recorded decision, not yet emailed, not deleted', () => {
      const where = buildCandidateWhere(now);

      expect(where.fundingDecision).toEqual({ not: null });
      expect(where.fundingResultEmailSentAt).toBeNull();
      expect(where.deletedAt).toBeNull();
    });

    it('requires an active participant', () => {
      expect(buildCandidateWhere(now).participant).toEqual({
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      });
    });

    it('requires the program toggle on and an announcement date that is set and already reached', () => {
      expect(buildCandidateWhere(now).program).toEqual({
        fundingResultEmailsEnabled: true,
        fundingResultsAnnouncedAt: { not: null, lte: now },
      });
    });

    it('reads oldest decision first, capped at 100', async () => {
      await service.sendDueResults(now);

      const args = mockPrisma.participantApplication.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ fundingDecidedAt: 'asc' });
      expect(args.take).toBe(100);
      expect(args.where).toEqual(buildCandidateWhere(now));
    });
  });

  describe('claim and send', () => {
    it('claims BEFORE emitting, then emits notification.funding_result with a deterministic messageId', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([makeCandidate()]);

      const report = await service.sendDueResults(now);

      expect(report).toMatchObject({ scanned: 1, sent: 1, errors: 0 });
      expect(mockPrisma.participantApplication.updateMany).toHaveBeenCalledWith({
        where: { id: 'app-1', fundingResultEmailSentAt: null, fundingDecision: 'awarded' },
        data: { fundingResultEmailSentAt: expect.any(Date) },
      });
      const claimOrder = mockPrisma.participantApplication.updateMany.mock.invocationCallOrder[0];
      const emitOrder = mockRabbitmq.emit.mock.invocationCallOrder[0];
      expect(claimOrder).toBeLessThan(emitOrder);

      expect(mockRabbitmq.emit).toHaveBeenCalledWith(
        'notification.funding_result',
        expect.objectContaining({
          email: 'jane@example.com',
          customer_name: 'Jane Doe',
          program_name: 'China Youth Summit 2027',
          application_id: 'app-1',
          decision: 'awarded',
          portal_url: 'https://cys.example.com/dashboard',
          brand: expect.objectContaining({ name: 'CYS', contactEmail: 'contact@example.com' }),
        }),
        { messageId: 'funding_result:app-1' },
      );
    });

    it('carries not_awarded through unchanged', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([
        makeCandidate({ fundingDecision: 'not_awarded' }),
      ]);

      await service.sendDueResults(now);

      expect(mockRabbitmq.emit.mock.calls[0][1].decision).toBe('not_awarded');
      expect(mockPrisma.participantApplication.updateMany.mock.calls[0][0].where.fundingDecision).toBe(
        'not_awarded',
      );
    });

    it('second replica (claim matches 0 rows) never emits', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([makeCandidate()]);
      mockPrisma.participantApplication.updateMany.mockResolvedValueOnce({ count: 0 });

      const report = await service.sendDueResults(now);

      expect(mockRabbitmq.emit).not.toHaveBeenCalled();
      expect(report).toMatchObject({ notClaimed: 1, sent: 0 });
    });

    it('skips a candidate with no email without claiming it', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([
        makeCandidate({ participant: { fullName: '', user: { email: null } } }),
      ]);

      const report = await service.sendDueResults(now);

      expect(report.skipped).toBe(1);
      expect(mockPrisma.participantApplication.updateMany).not.toHaveBeenCalled();
    });

    it('passes an empty full_name through untouched (notification renders the "there" fallback)', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([
        makeCandidate({ participant: { fullName: '', user: { email: 'jane@example.com' } } }),
      ]);

      await service.sendDueResults(now);

      expect(mockRabbitmq.emit.mock.calls[0][1].customer_name).toBe('');
    });

    it('counts a failed emit as an error and keeps going', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([
        makeCandidate({ id: 'a' }),
        makeCandidate({ id: 'b' }),
      ]);
      mockRabbitmq.emit.mockRejectedValueOnce(new Error('broker down'));

      const report = await service.sendDueResults(now);

      expect(report).toMatchObject({ errors: 1, sent: 1 });
    });
  });

  describe('scheduled run / kill switch', () => {
    it('runs under the cron lock by default', async () => {
      await service.runScheduledSends();

      expect(runExclusive).toHaveBeenCalledWith('funding-result-email', expect.any(Function));
      expect(mockPrisma.participantApplication.findMany).toHaveBeenCalled();
    });

    it.each(['false', '0', 'off'])('does nothing when FUNDING_RESULT_EMAIL_ENABLED=%s', async (value) => {
      process.env.FUNDING_RESULT_EMAIL_ENABLED = value;

      await service.runScheduledSends();

      expect(runExclusive).not.toHaveBeenCalled();
      expect(mockPrisma.participantApplication.findMany).not.toHaveBeenCalled();
    });

    it('stays on when FUNDING_RESULT_EMAIL_ENABLED=true', async () => {
      process.env.FUNDING_RESULT_EMAIL_ENABLED = 'true';

      await service.runScheduledSends();

      expect(runExclusive).toHaveBeenCalled();
    });

    it('logs the run report without any email address', async () => {
      const log = jest.spyOn(service['logger'], 'log').mockImplementation();
      mockPrisma.participantApplication.findMany.mockResolvedValueOnce([makeCandidate()]);

      await service.runScheduledSends();

      const lines = log.mock.calls.map((c) => String(c[0])).join('\n');
      expect(lines).toContain('[funding-result-email] scanned=1 sent=1');
      expect(lines).not.toContain('@');
    });
  });
});
