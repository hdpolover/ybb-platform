import { Test } from '@nestjs/testing';
import { LoaEligibilityService } from './loa-eligibility.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('LoaEligibilityService', () => {
  let service: LoaEligibilityService;
  let mockPrisma: {
    participantApplication: { findFirst: jest.Mock };
    loaReleaseBatch: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      participantApplication: { findFirst: jest.fn() },
      loaReleaseBatch: { findFirst: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        LoaEligibilityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(LoaEligibilityService);
  });

  it('returns not eligible when the application does not exist', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue(null);

    const result = await service.checkEligibility('app-missing', 'prog-1');

    expect(result).toEqual({ eligible: false });
    expect(mockPrisma.loaReleaseBatch.findFirst).not.toHaveBeenCalled();
  });

  it('returns not eligible when the application status is rejected', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'rejected',
      submittedAt: new Date('2026-02-15'),
    });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: false });
    expect(mockPrisma.loaReleaseBatch.findFirst).not.toHaveBeenCalled();
  });

  it('returns not eligible when submittedAt is null', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'submitted',
      submittedAt: null,
    });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: false });
    expect(mockPrisma.loaReleaseBatch.findFirst).not.toHaveBeenCalled();
  });

  it('returns not eligible when no released batch covers the submission date', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'accepted',
      submittedAt: new Date('2026-02-15'),
    });
    // No batch matches (e.g. unreleased, soft-deleted, or date outside any window)
    mockPrisma.loaReleaseBatch.findFirst.mockResolvedValue(null);

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: false });
    expect(mockPrisma.loaReleaseBatch.findFirst).toHaveBeenCalledWith({
      where: {
        programId: 'prog-1',
        deletedAt: null,
        releasedAt: { not: null },
        submissionFrom: { lte: new Date('2026-02-15') },
        submissionTo: { gte: new Date('2026-02-15') },
      },
      select: { id: true },
    });
  });

  it('returns eligible with the matching batch id for an accepted application within a released batch window', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'accepted',
      submittedAt: new Date('2026-02-15'),
    });
    mockPrisma.loaReleaseBatch.findFirst.mockResolvedValue({ id: 'batch-1' });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: true, batchId: 'batch-1' });
  });

  it('returns eligible for a submitted (not yet accepted) application within a released batch window', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'submitted',
      submittedAt: new Date('2026-02-15'),
    });
    mockPrisma.loaReleaseBatch.findFirst.mockResolvedValue({ id: 'batch-1' });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: true, batchId: 'batch-1' });
  });
});
