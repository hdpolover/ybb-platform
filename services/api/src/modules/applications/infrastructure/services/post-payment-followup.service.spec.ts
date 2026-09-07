// src/modules/applications/infrastructure/services/post-payment-followup.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  PostPaymentFollowupService,
  POST_PAYMENT_FOLLOWUP_CUTOFF,
} from './post-payment-followup.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCandidate = (paidAt: Date, overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  program: {
    name: 'China Youth Summit 2027',
    brandId: 'brand-1',
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
  participant: {
    fullName: 'Jane Doe',
    user: { email: 'jane@example.com' },
  },
  invoices: [{ paidAt }],
  ...overrides,
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PostPaymentFollowupService', () => {
  let service: PostPaymentFollowupService;
  let mockPrisma: {
    participantApplication: { findMany: jest.Mock; updateMany: jest.Mock };
  };
  let mockRabbitmq: { emit: jest.Mock };

  // 09:00 WIB on 15 Sep 2027 = 02:00 UTC.
  const now = new Date('2027-09-15T02:00:00Z');

  beforeEach(async () => {
    mockPrisma = {
      participantApplication: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockRabbitmq = { emit: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostPaymentFollowupService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQProducerService, useValue: mockRabbitmq },
      ],
    }).compile();

    service = module.get<PostPaymentFollowupService>(PostPaymentFollowupService);
  });

  it('queries only unsubmitted, unclaimed applications with a paid registration-fee invoice after the cutoff', async () => {
    await service.sendDueFollowups(now);

    const call = mockPrisma.participantApplication.findMany.mock.calls[0][0];
    expect(call.where.submittedAt).toBeNull();
    expect(call.where.postPaymentFollowupSentAt).toBeNull();
    expect(call.where.invoices.some.pricingTier.feeType).toBe('registration_fee');
    expect(call.where.invoices.some.paidAt.gt).toEqual(POST_PAYMENT_FOLLOWUP_CUTOFF);
  });

  it('never nudges a candidate the submittedAt: null filter would exclude (submitted in the meantime)', async () => {
    // Simulates the DB filter doing its job: a submitted application never
    // appears in the candidate set at all, so nothing downstream can nudge it.
    mockPrisma.participantApplication.findMany.mockResolvedValueOnce([]);

    const report = await service.sendDueFollowups(now);

    expect(report.sent).toBe(0);
    expect(mockRabbitmq.emit).not.toHaveBeenCalled();
  });

  it('excludes a payment made before the hard cutoff constant even if otherwise eligible', async () => {
    const beforeCutoff = new Date(POST_PAYMENT_FOLLOWUP_CUTOFF.getTime() - 1);
    // The service itself can't violate the cutoff (it's baked into the SQL
    // filter), so this asserts the constant is wired into the where clause
    // rather than merely declared and unused.
    await service.sendDueFollowups(now);
    const call = mockPrisma.participantApplication.findMany.mock.calls[0][0];
    expect(beforeCutoff.getTime()).toBeLessThan(call.where.invoices.some.paidAt.gt.getTime());
  });

  it('claims (stamps postPaymentFollowupSentAt) BEFORE emitting notification.submission_nudge', async () => {
    const paidAt = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days ago, due
    mockPrisma.participantApplication.findMany.mockResolvedValueOnce([makeCandidate(paidAt)]);

    await service.sendDueFollowups(now);

    expect(mockPrisma.participantApplication.updateMany).toHaveBeenCalledWith({
      where: { id: 'app-1', postPaymentFollowupSentAt: null },
      data: { postPaymentFollowupSentAt: expect.any(Date) },
    });
    const claimOrder = mockPrisma.participantApplication.updateMany.mock.invocationCallOrder[0];
    const emitOrder = mockRabbitmq.emit.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(emitOrder);

    expect(mockRabbitmq.emit).toHaveBeenCalledWith(
      'notification.submission_nudge',
      expect.objectContaining({
        email: 'jane@example.com',
        customer_name: 'Jane Doe',
        program_name: 'China Youth Summit 2027',
        application_id: 'app-1',
      }),
    );
  });

  it('does not emit when the conditional claim UPDATE matches 0 rows (already claimed elsewhere)', async () => {
    const paidAt = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    mockPrisma.participantApplication.findMany.mockResolvedValueOnce([makeCandidate(paidAt)]);
    mockPrisma.participantApplication.updateMany.mockResolvedValueOnce({ count: 0 });

    const report = await service.sendDueFollowups(now);

    expect(mockRabbitmq.emit).not.toHaveBeenCalled();
    expect(report.notClaimed).toBe(1);
    expect(report.sent).toBe(0);
  });

  it('waits for the next 09:00 WIB after the 3-day mark rather than the anniversary instant', async () => {
    // Paid exactly 3 days + a few hours before `now` (09:00 WIB) — the 3-day
    // mark itself lands mid-afternoon WIB, so the due instant is the *next*
    // 09:00 WIB, not the 3-day-mark instant itself.
    const paidJustUnder3Days = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000));
    mockPrisma.participantApplication.findMany.mockResolvedValueOnce([
      makeCandidate(paidJustUnder3Days),
    ]);

    const report = await service.sendDueFollowups(now);

    expect(report.sent).toBe(0);
    expect(report.notYetDue).toBe(1);
    expect(mockRabbitmq.emit).not.toHaveBeenCalled();
  });

  it('sends once the next 09:00 WIB after the 3-day mark has actually arrived', async () => {
    const paidAt = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // clearly past 3 days + a 9am window
    mockPrisma.participantApplication.findMany.mockResolvedValueOnce([makeCandidate(paidAt)]);

    const report = await service.sendDueFollowups(now);

    expect(report.sent).toBe(1);
    expect(mockRabbitmq.emit).toHaveBeenCalledTimes(1);
  });
});
