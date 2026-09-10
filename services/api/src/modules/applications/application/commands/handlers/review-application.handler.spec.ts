// services/api/src/modules/applications/application/commands/handlers/review-application.handler.spec.ts
//
// Task 9: ReviewApplicationCommand no longer carries scoreTotal/scoreBreakdown/
// scoreStatus (the new scoring API - Tasks 7/8/8b - is now the sole writer of
// those columns). This spec covers the handler's remaining review paths.
//
// Audit M111/M112: the review-status write and applyAcceptanceMode's side
// effects now run inside a single `prisma.$transaction`, via a raw
// `tx.participantApplication.update`/`updateMany` rather than
// `applicationRepository.update`. `tx` is kept a disjoint mock from `mockPrisma`
// (never `cb(mockPrisma)`) so "was this write routed through the transaction"
// stays independently observable from "did the outer client see this write" -
// see test/utils/prisma-tx-mock.ts's docstring for why that separation matters.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReviewApplicationHandler } from './review-application.handler';
import { ReviewApplicationCommand } from '../review-application.command';
import { ApplicationStatus } from '@core/entities/participant-application.entity';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { createCacheServiceMock } from '@test/utils/cache-service-mock';

/** Flushes the fire-and-forget notification promise chain (findUnique -> emit). */
const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('ReviewApplicationHandler', () => {
  let handler: ReviewApplicationHandler;

  const buildApplication = (status: ApplicationStatus) => ({
    id: 'app-1',
    participantId: 'participant-1',
    status,
    canReview: jest.fn(() =>
      [
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.UNDER_REVIEW,
        ApplicationStatus.INTERVIEW_SCHEDULED,
      ].includes(status),
    ),
    accept: jest.fn(),
    reject: jest.fn(),
    waitlist: jest.fn(),
    scheduleInterview: jest.fn(),
    moveToReview: jest.fn(),
    addStatusToHistory: jest.fn(),
    reviewedBy: undefined,
    reviewedAt: undefined,
    reviewerNotes: undefined,
  });

  const mockApplicationRepository = {
    findById: jest.fn(),
    update: jest.fn(),
  };

  const mockApplicationMapper = {
    toDto: jest.fn((app: unknown) => app),
    toPrismaUpdate: jest.fn(() => ({ status: 'accepted' })),
    toDomain: jest.fn((row: unknown) => row),
  };

  // Derived from the real CacheService: this handler catches and logs
  // invalidation failures, so a hand-listed mock missing a method surfaced only
  // as a TypeError in the CI log while every test still passed.
  const mockCacheService = createCacheServiceMock();

  const mockReferralFunnel = {
    advanceToAccepted: jest.fn().mockResolvedValue(undefined),
  };

  // The transaction client. Disjoint from mockPrisma - see file header.
  const mockTx = {
    participantApplication: {
      update: jest.fn().mockResolvedValue({ id: 'app-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    applicationInvoice: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const mockPrisma = {
    applicationInvoice: {
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn(),
    },
    participant: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    },
    participantApplication: {
      update: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        program: {
          name: 'China Youth Summit 2027',
          brandId: 'brand-1',
          contactEmail: null,
          contactAddress: null,
          brand: {
            name: 'CYS',
            primaryColor: '#000',
            logoUrl: null,
            websiteUrl: null,
            socialMediaLinks: {},
            settings: null,
          },
        },
        participant: { fullName: 'Jane Doe', user: { email: 'jane@example.com' } },
      }),
    },
    $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  };

  const mockRabbitmqProducer = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewApplicationHandler,
        { provide: APPLICATION_REPOSITORY, useValue: mockApplicationRepository },
        { provide: ApplicationMapper, useValue: mockApplicationMapper },
        { provide: CacheService, useValue: mockCacheService },
        { provide: ReferralFunnelService, useValue: mockReferralFunnel },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQProducerService, useValue: mockRabbitmqProducer },
      ],
    }).compile();

    handler = module.get<ReviewApplicationHandler>(ReviewApplicationHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));
    mockPrisma.applicationInvoice.count.mockResolvedValue(0);
    mockTx.participantApplication.update.mockResolvedValue({ id: 'app-1' });
    mockTx.participantApplication.updateMany.mockResolvedValue({ count: 1 });
    mockTx.applicationInvoice.updateMany.mockResolvedValue({ count: 0 });
  });

  it('accepts a reviewable application and does not throw without score fields on the command', async () => {
    const application = buildApplication(ApplicationStatus.SUBMITTED);
    mockApplicationRepository.findById.mockResolvedValue(application);

    const command = new ReviewApplicationCommand(
      'app-1',
      'reviewer-1',
      ApplicationStatus.ACCEPTED,
      'looks good',
    );

    await expect(handler.execute(command)).resolves.toBeDefined();

    expect(application.accept).toHaveBeenCalledWith('reviewer-1', 'looks good');
    // The review write goes through the transaction client's raw update, not
    // applicationRepository.update (audit M111/M112 - see file header).
    expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
      where: { id: 'app-1' },
      data: expect.any(Object),
    });
    expect(mockApplicationRepository.update).not.toHaveBeenCalled();
  });

  it('builds the review patch from only the review-relevant fields (audit M112)', async () => {
    const application = buildApplication(ApplicationStatus.SUBMITTED);
    mockApplicationRepository.findById.mockResolvedValue(application);

    await handler.execute(
      new ReviewApplicationCommand('app-1', 'reviewer-1', ApplicationStatus.ACCEPTED, 'ok'),
    );

    expect(mockApplicationMapper.toPrismaUpdate).toHaveBeenCalledWith(application, [
      'status',
      'statusHistory',
      'reviewedBy',
      'reviewedAt',
      'reviewerNotes',
    ]);
  });

  // Coverage this file only appears to have had. The handler catches and logs
  // invalidation failures, so with a mock missing invalidatePortalCache these
  // specs passed while the whole invalidation path threw on every run. Silencing
  // the TypeError is not the point - asserting the call is.
  it('invalidates the participant portal cache after a successful review', async () => {
    const application = buildApplication(ApplicationStatus.SUBMITTED);
    mockApplicationRepository.findById.mockResolvedValue(application);

    await handler.execute(
      new ReviewApplicationCommand('app-1', 'reviewer-1', ApplicationStatus.ACCEPTED, 'ok'),
    );

    expect(mockCacheService.invalidatePortalCache).toHaveBeenCalled();
  });

  it('throws BadRequestException when the application is not in a reviewable state', async () => {
    const application = buildApplication(ApplicationStatus.ACCEPTED);
    mockApplicationRepository.findById.mockResolvedValue(application);

    const command = new ReviewApplicationCommand(
      'app-1',
      'reviewer-1',
      ApplicationStatus.ACCEPTED,
    );

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when accepting as ambassador while a payment is processing or paid', async () => {
    const application = buildApplication(ApplicationStatus.SUBMITTED);
    mockApplicationRepository.findById.mockResolvedValue(application);
    mockPrisma.applicationInvoice.count.mockResolvedValue(1);

    const command = new ReviewApplicationCommand(
      'app-1',
      'reviewer-1',
      ApplicationStatus.ACCEPTED,
      undefined,
      'ambassador',
    );

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    expect(application.accept).not.toHaveBeenCalled();
    expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
  });

  // M111: applyAcceptanceMode's ambassador branch now runs inside the SAME
  // transaction as the review-status write, and guards the
  // registrationPaymentStatus write with an updateMany WHERE clause instead
  // of an unconditional update - see review-application.handler.ts.
  describe('ambassador acceptance (M111 transactional guard)', () => {
    it('runs the review update and the acceptance-mode writes in one transaction', async () => {
      const application = buildApplication(ApplicationStatus.SUBMITTED);
      mockApplicationRepository.findById.mockResolvedValue(application);

      await handler.execute(
        new ReviewApplicationCommand('app-1', 'reviewer-1', ApplicationStatus.ACCEPTED, 'ok', 'ambassador'),
      );

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: expect.any(Object),
      });
      expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { ticketStatus: 'ambassador' },
      });
      expect(mockTx.participantApplication.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'app-1',
          registrationPaymentStatus: { notIn: ['paid', 'processing'] },
        },
        data: { registrationPaymentStatus: 'cancelled' },
      });
    });

    it('still sets ticketStatus to ambassador, but leaves registrationPaymentStatus untouched, when the guard finds a concurrent payment (0 rows)', async () => {
      const application = buildApplication(ApplicationStatus.SUBMITTED);
      mockApplicationRepository.findById.mockResolvedValue(application);
      // Simulates a payment webhook having already landed between
      // assertAmbassadorAcceptanceAllowed's check and this write.
      mockTx.participantApplication.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        handler.execute(
          new ReviewApplicationCommand('app-1', 'reviewer-1', ApplicationStatus.ACCEPTED, 'ok', 'ambassador'),
        ),
      ).resolves.toBeDefined();

      expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { ticketStatus: 'ambassador' },
      });
      // The transaction still committed successfully - a 0-row guard is a
      // no-op, not a thrown error.
      expect(mockTx.applicationInvoice.updateMany).toHaveBeenCalled();
    });

    it('sets ticketStatus to regular for participant-mode acceptance, without touching registrationPaymentStatus', async () => {
      const application = buildApplication(ApplicationStatus.SUBMITTED);
      mockApplicationRepository.findById.mockResolvedValue(application);

      await handler.execute(
        new ReviewApplicationCommand('app-1', 'reviewer-1', ApplicationStatus.ACCEPTED, 'ok', 'participant'),
      );

      expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { ticketStatus: 'regular' },
      });
      expect(mockTx.participantApplication.updateMany).not.toHaveBeenCalled();
    });
  });

  it('emits notification.application_accepted on a genuine transition into accepted', async () => {
    const application = buildApplication(ApplicationStatus.SUBMITTED);
    mockApplicationRepository.findById.mockResolvedValue(application);

    await handler.execute(
      new ReviewApplicationCommand('app-1', 'reviewer-1', ApplicationStatus.ACCEPTED, 'ok'),
    );
    await flushMicrotasks();

    expect(mockRabbitmqProducer.emit).toHaveBeenCalledWith(
      'notification.application_accepted',
      expect.objectContaining({
        email: 'jane@example.com',
        customer_name: 'Jane Doe',
        program_name: 'China Youth Summit 2027',
        application_id: 'app-1',
      }),
    );
  });

  it('does not emit notification.application_accepted on reject', async () => {
    const application = buildApplication(ApplicationStatus.SUBMITTED);
    mockApplicationRepository.findById.mockResolvedValue(application);

    await handler.execute(
      new ReviewApplicationCommand('app-1', 'reviewer-1', ApplicationStatus.REJECTED, 'no'),
    );
    await flushMicrotasks();

    expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
  });

  it('never re-fires on a re-review of an already-accepted application (blocked upstream by canReview)', async () => {
    const application = buildApplication(ApplicationStatus.ACCEPTED);
    mockApplicationRepository.findById.mockResolvedValue(application);

    await expect(
      handler.execute(new ReviewApplicationCommand('app-1', 'reviewer-1', ApplicationStatus.ACCEPTED)),
    ).rejects.toThrow(BadRequestException);
    await flushMicrotasks();

    expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
  });

  it('does not let a notification failure fail the review action', async () => {
    const application = buildApplication(ApplicationStatus.SUBMITTED);
    mockApplicationRepository.findById.mockResolvedValue(application);
    mockRabbitmqProducer.emit.mockRejectedValueOnce(new Error('broker down'));

    const command = new ReviewApplicationCommand('app-1', 'reviewer-1', ApplicationStatus.ACCEPTED, 'ok');

    await expect(handler.execute(command)).resolves.toBeDefined();
    await flushMicrotasks();
  });
});
