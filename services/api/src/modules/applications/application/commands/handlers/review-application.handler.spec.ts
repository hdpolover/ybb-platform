// services/api/src/modules/applications/application/commands/handlers/review-application.handler.spec.ts
//
// Task 9: ReviewApplicationCommand no longer carries scoreTotal/scoreBreakdown/
// scoreStatus (the new scoring API - Tasks 7/8/8b - is now the sole writer of
// those columns). This spec covers the handler's remaining review paths.
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
  };

  const mockCacheService = {
    invalidateKey: jest.fn().mockResolvedValue(undefined),
    invalidateByPattern: jest.fn().mockResolvedValue(undefined),
  };

  const mockReferralFunnel = {
    advanceToAccepted: jest.fn().mockResolvedValue(undefined),
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
    },
    $transaction: jest.fn(),
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
      ],
    }).compile();

    handler = module.get<ReviewApplicationHandler>(ReviewApplicationHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a reviewable application and does not throw without score fields on the command', async () => {
    const application = buildApplication(ApplicationStatus.SUBMITTED);
    mockApplicationRepository.findById.mockResolvedValue(application);
    mockApplicationRepository.update.mockResolvedValue(application);

    const command = new ReviewApplicationCommand(
      'app-1',
      'reviewer-1',
      ApplicationStatus.ACCEPTED,
      'looks good',
    );

    await expect(handler.execute(command)).resolves.toBeDefined();

    expect(application.accept).toHaveBeenCalledWith('reviewer-1', 'looks good');
    expect(mockApplicationRepository.update).toHaveBeenCalledWith(application);
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
    expect(mockApplicationRepository.update).not.toHaveBeenCalled();
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
    expect(mockApplicationRepository.update).not.toHaveBeenCalled();
  });
});
