import { Test } from '@nestjs/testing';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LoaReleaseBatchRepository } from './loa-release-batch.repository';

describe('LoaReleaseBatchRepository', () => {
  let repo: LoaReleaseBatchRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockBatch = {
    id: 'batch-1',
    programId: 'prog-1',
    name: 'Wave 1',
    paymentFrom: new Date('2026-01-01'),
    paymentTo: new Date('2026-03-31'),
    releasedAt: null,
    createdBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LoaReleaseBatchRepository,
        {
          provide: PrismaService,
          useValue: {
            loaReleaseBatch: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            participantApplication: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();
    repo = module.get(LoaReleaseBatchRepository);
    prisma = module.get(PrismaService);
  });

  it('findByProgram returns active batches for a program', async () => {
    (prisma.loaReleaseBatch.findMany as jest.Mock).mockResolvedValue([mockBatch]);
    const result = await repo.findByProgram('prog-1');
    expect(prisma.loaReleaseBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ programId: 'prog-1', deletedAt: null }) }),
    );
    expect(result).toHaveLength(1);
  });

  it('findOverlapping returns batches whose range overlaps the given range', async () => {
    (prisma.loaReleaseBatch.findMany as jest.Mock).mockResolvedValue([mockBatch]);
    const result = await repo.findOverlapping('prog-1', new Date('2026-02-01'), new Date('2026-04-30'));
    expect(result).toHaveLength(1);
  });

  it('findOverlapping excludes the given excludeId', async () => {
    (prisma.loaReleaseBatch.findMany as jest.Mock).mockResolvedValue([]);
    await repo.findOverlapping('prog-1', new Date('2026-02-01'), new Date('2026-04-30'), 'batch-1');
    expect(prisma.loaReleaseBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ NOT: { id: 'batch-1' } }),
      }),
    );
  });

  it('create saves a new batch', async () => {
    (prisma.loaReleaseBatch.create as jest.Mock).mockResolvedValue(mockBatch);
    const result = await repo.create({
      programId: 'prog-1',
      name: 'Wave 1',
      paymentFrom: new Date('2026-01-01'),
      paymentTo: new Date('2026-03-31'),
      createdBy: 'admin-1',
    });
    expect(prisma.loaReleaseBatch.create).toHaveBeenCalled();
    expect(result.name).toBe('Wave 1');
  });

  it('release sets releasedAt and reports transitioned:true on the first release', async () => {
    (prisma.loaReleaseBatch.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.loaReleaseBatch.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...mockBatch,
      releasedAt: new Date(),
    });

    const result = await repo.release('batch-1');

    expect(prisma.loaReleaseBatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'batch-1', releasedAt: null },
        data: expect.objectContaining({ releasedAt: expect.any(Date) }),
      }),
    );
    expect(result.transitioned).toBe(true);
    expect(result.batch.releasedAt).toBeInstanceOf(Date);
  });

  it('release is idempotent: reports transitioned:false when already released', async () => {
    (prisma.loaReleaseBatch.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.loaReleaseBatch.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...mockBatch,
      releasedAt: new Date('2026-01-05'),
    });

    const result = await repo.release('batch-1');

    expect(result.transitioned).toBe(false);
  });

  it('findEligibleRecipients maps submitted/accepted applications in-window to userId/email/fullName', async () => {
    (prisma.participantApplication.findMany as jest.Mock).mockResolvedValue([
      {
        participant: {
          fullName: 'Jane Doe',
          user: { id: 'user-1', email: 'jane@example.com' },
        },
      },
    ]);

    const result = await repo.findEligibleRecipients(
      'prog-1',
      new Date('2026-01-01'),
      new Date('2026-03-31'),
    );

    expect(prisma.participantApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programId: 'prog-1',
          status: { in: ['submitted', 'accepted'] },
          deletedAt: null,
        }),
      }),
    );
    expect(result).toEqual([{ userId: 'user-1', email: 'jane@example.com', fullName: 'Jane Doe' }]);
  });

  it('findEligibleRecipients excludes deactivated/deleted accounts from the LOA-ready query', async () => {
    (prisma.participantApplication.findMany as jest.Mock).mockResolvedValue([]);

    await repo.findEligibleRecipients('prog-1', new Date('2026-01-01'), new Date('2026-03-31'));

    expect(prisma.participantApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          participant: { deletedAt: null, user: { isActive: true, deletedAt: null } },
        }),
      }),
    );
  });

  // The actual bug: an admin manually submits a late-paying participant today,
  // long after they paid. Their submittedAt is outside the batch window, but
  // their payment is inside it. This asserts the FULL where clause (exact
  // equality, not objectContaining) so both directions of the fix are proven
  // at once:
  //  1. submittedAt is not a key anywhere in the clause, so a submission
  //     dated outside the window (the late-manual-submission case) cannot
  //     exclude an otherwise-eligible application.
  //  2. the invoices-paid-in-window clause is a mandatory top-level key (not
  //     inside an optional OR), so an application that never paid in the
  //     window cannot match no matter what its submittedAt is.
  it('findEligibleRecipients matches on the PAID invoice window, not on submittedAt', async () => {
    (prisma.participantApplication.findMany as jest.Mock).mockResolvedValue([]);

    const windowFrom = new Date('2026-01-01');
    const windowTo = new Date('2026-03-31');
    await repo.findEligibleRecipients('prog-1', windowFrom, windowTo);

    const [{ where }] = (prisma.participantApplication.findMany as jest.Mock).mock.calls[0];
    expect(where).toEqual({
      programId: 'prog-1',
      status: { in: ['submitted', 'accepted'] },
      deletedAt: null,
      participant: { deletedAt: null, user: { isActive: true, deletedAt: null } },
      invoices: {
        some: {
          status: 'paid',
          paidAt: { gte: windowFrom, lte: windowTo },
        },
      },
    });
  });

  it('unrelease clears releasedAt', async () => {
    (prisma.loaReleaseBatch.update as jest.Mock).mockResolvedValue({ ...mockBatch, releasedAt: null });
    await repo.unrelease('batch-1');
    expect(prisma.loaReleaseBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'batch-1' }, data: { releasedAt: null } }),
    );
  });
});
