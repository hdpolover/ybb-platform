import { Test } from '@nestjs/testing';
import { LoaEligibilityService } from './loa-eligibility.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('LoaEligibilityService', () => {
  let service: LoaEligibilityService;
  let mockPrisma: {
    participantApplication: { findFirst: jest.Mock; findMany: jest.Mock };
    loaReleaseBatch: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      participantApplication: { findFirst: jest.fn(), findMany: jest.fn() },
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
      invoices: [{ paidAt: new Date('2026-02-10') }],
    });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: false });
    expect(mockPrisma.loaReleaseBatch.findFirst).not.toHaveBeenCalled();
  });

  it('returns not eligible when submittedAt is null', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'submitted',
      submittedAt: null,
      invoices: [{ paidAt: new Date('2026-02-10') }],
    });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: false });
    expect(mockPrisma.loaReleaseBatch.findFirst).not.toHaveBeenCalled();
  });


  // The batch and this gate must agree on WHICH date the window is matched
  // against. A batch selects its recipients by payment date; if this gate kept
  // matching on submittedAt, someone paid inside the window but submitted after
  // it - an admin submitting a late participant stamps today - would be emailed
  // "your Invitation Letter is ready" and then refused the download. Not a 5xx,
  // and indistinguishable from an unreleased batch for support.
  it('is eligible when the payment falls in the window even though the submission does not', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'submitted',
      // Submitted well AFTER the batch window closed.
      submittedAt: new Date('2026-09-05'),
      // Paid inside it.
      invoices: [{ paidAt: new Date('2026-06-10') }],
    });
    mockPrisma.loaReleaseBatch.findFirst.mockResolvedValue({ id: 'batch-1' });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: true, batchId: 'batch-1' });
    // The window is compared against the PAYMENT date, never submittedAt.
    const where = mockPrisma.loaReleaseBatch.findFirst.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { paymentFrom: { lte: new Date('2026-06-10') }, paymentTo: { gte: new Date('2026-06-10') } },
    ]);
  });

  it('is not eligible when the application has never paid', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'submitted',
      submittedAt: new Date('2026-06-15'),
      invoices: [],
    });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: false });
    // An empty OR would have matched EVERY batch rather than none.
    expect(mockPrisma.loaReleaseBatch.findFirst).not.toHaveBeenCalled();
  });

  it('considers every payment, so one before the window does not mask one inside it', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'submitted',
      submittedAt: new Date('2026-06-15'),
      invoices: [{ paidAt: new Date('2026-01-05') }, { paidAt: new Date('2026-06-10') }],
    });
    mockPrisma.loaReleaseBatch.findFirst.mockResolvedValue({ id: 'batch-1' });

    await service.checkEligibility('app-1', 'prog-1');

    expect(mockPrisma.loaReleaseBatch.findFirst.mock.calls[0][0].where.OR).toHaveLength(2);
  });

  it('returns not eligible when no released batch covers the payment date', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'accepted',
      submittedAt: new Date('2026-02-15'),
      invoices: [{ paidAt: new Date('2026-02-10') }],
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
        // Matched against the PAYMENT date (2026-02-10), not submittedAt.
        OR: [
          { paymentFrom: { lte: new Date('2026-02-10') }, paymentTo: { gte: new Date('2026-02-10') } },
        ],
      },
      select: { id: true },
    });
  });

  it('returns eligible with the matching batch id for an accepted application within a released batch window', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'accepted',
      submittedAt: new Date('2026-02-15'),
      invoices: [{ paidAt: new Date('2026-02-10') }],
    });
    mockPrisma.loaReleaseBatch.findFirst.mockResolvedValue({ id: 'batch-1' });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: true, batchId: 'batch-1' });
  });

  it('returns eligible for a submitted (not yet accepted) application within a released batch window', async () => {
    mockPrisma.participantApplication.findFirst.mockResolvedValue({
      status: 'submitted',
      submittedAt: new Date('2026-02-15'),
      invoices: [{ paidAt: new Date('2026-02-10') }],
    });
    mockPrisma.loaReleaseBatch.findFirst.mockResolvedValue({ id: 'batch-1' });

    const result = await service.checkEligibility('app-1', 'prog-1');

    expect(result).toEqual({ eligible: true, batchId: 'batch-1' });
  });

  // These assertions used to live on LoaDownloadService. They belong here now:
  // the candidate query is shared so the documents list and the download
  // endpoint cannot disagree about what is downloadable.
  describe('resolveEligibleApplications', () => {
    const eligible = { eligible: true, batchId: 'batch-1' };

    it('scopes candidates by brand, which the download path used to ignore entirely', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValue([]);

      await service.resolveEligibleApplications('participant-1', 'brand-1');

      expect(mockPrisma.participantApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ program: { brandId: 'brand-1' } }) }),
      );
    });

    it('never offers a withdrawn or soft-deleted application as a letter candidate', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValue([]);

      await service.resolveEligibleApplications('participant-1', 'brand-1');

      const where = mockPrisma.participantApplication.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ deletedAt: null, withdrawnAt: null });
    });

    it('narrows to the caller-supplied programme when given one', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValue([]);

      await service.resolveEligibleApplications('participant-1', 'brand-1', 'program-9');

      const where = mockPrisma.participantApplication.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ programId: 'program-9' });
    });

    it('returns only the applications that pass the eligibility gate', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValue([
        { id: 'app-1', programId: 'prog-1' },
        { id: 'app-2', programId: 'prog-2' },
      ]);
      jest.spyOn(service, 'checkEligibility').mockImplementation(async (applicationId: string) =>
        applicationId === 'app-2' ? eligible : { eligible: false },
      );

      const result = await service.resolveEligibleApplications('participant-1', 'brand-1');

      expect(result).toHaveLength(1);
      expect(result[0].application.id).toBe('app-2');
      expect(result[0].batchId).toBe('batch-1');
    });

    it('checks candidates concurrently rather than one after another', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValue([
        { id: 'app-1', programId: 'prog-1' },
        { id: 'app-2', programId: 'prog-2' },
        { id: 'app-3', programId: 'prog-3' },
      ]);
      let inFlight = 0;
      let peak = 0;
      jest.spyOn(service, 'checkEligibility').mockImplementation(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return eligible;
      });

      await service.resolveEligibleApplications('participant-1', 'brand-1');

      expect(peak).toBeGreaterThan(1);
    });
  });
});
