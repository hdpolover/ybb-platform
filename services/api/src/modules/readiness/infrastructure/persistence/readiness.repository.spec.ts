import { Test, TestingModule } from '@nestjs/testing';
import { ReadinessRepository } from './readiness.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

const mockPrisma = { readinessOverride: { create: jest.fn() }, readinessSnapshot: { upsert: jest.fn() } };
const mockRead = { readinessOverride: { findMany: jest.fn() }, readinessSnapshot: { findMany: jest.fn() } };

describe('ReadinessRepository', () => {
  let repo: ReadinessRepository;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessRepository,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PrismaReadService, useValue: mockRead },
      ],
    }).compile();
    repo = moduleRef.get(ReadinessRepository);
    jest.clearAllMocks();
  });

  it('excludes revoked and soft-deleted overrides when loading active ones', async () => {
    mockRead.readinessOverride.findMany.mockResolvedValue([]);
    await repo.findActiveOverrides('brand', 'b1');
    expect(mockRead.readinessOverride.findMany).toHaveBeenCalledWith({
      where: { subjectType: 'brand', subjectId: 'b1', revokedAt: null, deletedAt: null },
      select: { ruleId: true, reason: true, adminId: true, expiresAt: true },
    });
  });

  it('upserts a snapshot so re-evaluation replaces rather than accumulates', async () => {
    mockPrisma.readinessSnapshot.upsert.mockResolvedValue({});
    await repo.saveSnapshot('program', 'p1', 'b1', {
      results: [], blockerCount: 2, warningCount: 1, unknownCount: 0,
      isReady: false, evaluatedAt: new Date('2026-09-08T00:00:00Z'),
    });
    const call = mockPrisma.readinessSnapshot.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ subjectType_subjectId: { subjectType: 'program', subjectId: 'p1' } });
    expect(call.create.blockerCount).toBe(2);
    expect(call.update.blockerCount).toBe(2);
  });
});
