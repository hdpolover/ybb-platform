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
    submissionFrom: new Date('2026-01-01'),
    submissionTo: new Date('2026-03-31'),
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
              create: jest.fn(),
              update: jest.fn(),
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
      submissionFrom: new Date('2026-01-01'),
      submissionTo: new Date('2026-03-31'),
      createdBy: 'admin-1',
    });
    expect(prisma.loaReleaseBatch.create).toHaveBeenCalled();
    expect(result.name).toBe('Wave 1');
  });

  it('release sets releasedAt to now', async () => {
    (prisma.loaReleaseBatch.update as jest.Mock).mockResolvedValue({ ...mockBatch, releasedAt: new Date() });
    await repo.release('batch-1');
    expect(prisma.loaReleaseBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'batch-1' }, data: expect.objectContaining({ releasedAt: expect.any(Date) }) }),
    );
  });

  it('unrelease clears releasedAt', async () => {
    (prisma.loaReleaseBatch.update as jest.Mock).mockResolvedValue({ ...mockBatch, releasedAt: null });
    await repo.unrelease('batch-1');
    expect(prisma.loaReleaseBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'batch-1' }, data: { releasedAt: null } }),
    );
  });
});
