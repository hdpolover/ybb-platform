import { Test, TestingModule } from '@nestjs/testing';
import { ReadinessRepository } from './readiness.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

const mockPrisma = {
  readinessOverride: { create: jest.fn() },
  readinessSnapshot: { upsert: jest.fn() },
  readinessAlertBaseline: { upsert: jest.fn() },
};
const mockRead = {
  readinessOverride: { findMany: jest.fn() },
  readinessSnapshot: { findMany: jest.fn() },
  readinessAlertBaseline: { findUnique: jest.fn() },
};

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

  it('excludes revoked and soft-deleted overrides when loading active ones, newest first', async () => {
    mockRead.readinessOverride.findMany.mockResolvedValue([]);
    await repo.findActiveOverrides('brand', 'b1');
    expect(mockRead.readinessOverride.findMany).toHaveBeenCalledWith({
      where: { subjectType: 'brand', subjectId: 'b1', revokedAt: null, deletedAt: null },
      select: { ruleId: true, reason: true, adminId: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('upserts a snapshot so re-evaluation replaces rather than accumulates, including unknownCount and names', async () => {
    mockPrisma.readinessSnapshot.upsert.mockResolvedValue({});
    await repo.saveSnapshot(
      'program',
      'p1',
      'b1',
      {
        results: [], blockerCount: 2, warningCount: 1, unknownCount: 3,
        isReady: false, evaluatedAt: new Date('2026-09-08T00:00:00Z'),
      },
      { subjectName: 'Korea Youth Summit 2027', brandName: 'Korea Youth Summit' },
    );
    const call = mockPrisma.readinessSnapshot.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ subjectType_subjectId: { subjectType: 'program', subjectId: 'p1' } });
    expect(call.create.blockerCount).toBe(2);
    expect(call.update.blockerCount).toBe(2);
    expect(call.create.unknownCount).toBe(3);
    expect(call.create.subjectName).toBe('Korea Youth Summit 2027');
    expect(call.create.brandName).toBe('Korea Youth Summit');
  });

  it('stores a null brandName when the caller omits it (a brand-subject snapshot)', async () => {
    mockPrisma.readinessSnapshot.upsert.mockResolvedValue({});
    await repo.saveSnapshot(
      'brand',
      'b1',
      'b1',
      { results: [], blockerCount: 0, warningCount: 0, unknownCount: 0, isReady: true, evaluatedAt: new Date() },
      { subjectName: 'Korea Youth Summit' },
    );
    const call = mockPrisma.readinessSnapshot.upsert.mock.calls[0][0];
    expect(call.create.brandName).toBeNull();
  });

  describe('alert baseline', () => {
    it('returns null when no baseline has been recorded yet', async () => {
      mockRead.readinessAlertBaseline.findUnique.mockResolvedValue(null);
      await expect(repo.getAlertBaseline('program', 'p1')).resolves.toBeNull();
    });

    it('returns the stored blocker rule ids', async () => {
      mockRead.readinessAlertBaseline.findUnique.mockResolvedValue({
        blockerRuleIds: ['program.has-pricing-tiers'],
      });
      await expect(repo.getAlertBaseline('program', 'p1')).resolves.toEqual(['program.has-pricing-tiers']);
    });

    it('upserts the baseline keyed by subject', async () => {
      mockPrisma.readinessAlertBaseline.upsert.mockResolvedValue({});
      await repo.saveAlertBaseline('program', 'p1', ['program.has-pricing-tiers']);
      const call = mockPrisma.readinessAlertBaseline.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ subjectType_subjectId: { subjectType: 'program', subjectId: 'p1' } });
      expect(call.create.blockerRuleIds).toEqual(['program.has-pricing-tiers']);
      expect(call.update.blockerRuleIds).toEqual(['program.has-pricing-tiers']);
    });
  });
});
