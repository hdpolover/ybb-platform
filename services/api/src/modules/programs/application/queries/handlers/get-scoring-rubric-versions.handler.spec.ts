// services/api/src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.spec.ts
import { Prisma, ScoringStage } from '@prisma/client';
import { GetScoringRubricVersionsHandler } from './get-scoring-rubric-versions.handler';
import { GetScoringRubricVersionsQuery } from '../get-scoring-rubric-versions.query';

const programId = 'prog-uuid-1';

function makeVersion(overrides: {
  id: string;
  version: number;
  isActive: boolean;
  createdById: string | null;
}) {
  return {
    ...overrides,
    programId,
    stage: ScoringStage.application,
    name: 'Application Rubric',
    description: null,
    passThreshold: new Prisma.Decimal(75),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    deletedAt: null,
    legacyId: null,
    categories: [],
  };
}

describe('GetScoringRubricVersionsHandler', () => {
  let handler: GetScoringRubricVersionsHandler;
  let mockRepo: { findRubricHistory: jest.Mock };
  let mockProgramRepo: { findBySlug: jest.Mock };
  let mockPrisma: {
    admin: { findMany: jest.Mock };
    applicationReview: { groupBy: jest.Mock };
  };

  beforeEach(() => {
    mockRepo = { findRubricHistory: jest.fn() };
    mockProgramRepo = { findBySlug: jest.fn() };
    mockPrisma = {
      admin: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1', fullName: 'Alice Admin' }]) },
      applicationReview: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    handler = new GetScoringRubricVersionsHandler(mockRepo as any, mockProgramRepo as any, mockPrisma as any);
  });

  it('marks a version true for hasSubmittedReviews when a submitted review exists against its schema id', async () => {
    const v2 = makeVersion({ id: 'schema-v2', version: 2, isActive: true, createdById: 'admin-1' });
    const v1 = makeVersion({ id: 'schema-v1', version: 1, isActive: false, createdById: 'admin-1' });
    mockRepo.findRubricHistory.mockResolvedValue([v2, v1]);
    mockPrisma.applicationReview.groupBy.mockResolvedValue([
      { schemaId: 'schema-v1', _count: { _all: 1 } },
    ]);

    const result = await handler.execute(new GetScoringRubricVersionsQuery(programId, ScoringStage.application));

    expect(mockPrisma.applicationReview.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['schemaId'],
        where: { schemaId: { in: ['schema-v2', 'schema-v1'] }, status: 'submitted' },
      }),
    );

    const byVersion = Object.fromEntries(result.map((r) => [r.version, r]));
    expect(byVersion[1].hasSubmittedReviews).toBe(true);
    expect(byVersion[2].hasSubmittedReviews).toBe(false);
  });

  it('leaves hasSubmittedReviews false for a version with only a draft review, since groupBy filters status=submitted', async () => {
    const v1 = makeVersion({ id: 'schema-v1', version: 1, isActive: true, createdById: 'admin-1' });
    mockRepo.findRubricHistory.mockResolvedValue([v1]);
    // A draft-only review never satisfies the where: { status: 'submitted' } filter,
    // so groupBy legitimately returns no row for schema-v1 here.
    mockPrisma.applicationReview.groupBy.mockResolvedValue([]);

    const result = await handler.execute(new GetScoringRubricVersionsQuery(programId, ScoringStage.application));

    expect(result[0].hasSubmittedReviews).toBe(false);
  });

  it('resolves createdByName from the admins table and returns null when createdById is null', async () => {
    const v1 = makeVersion({ id: 'schema-v1', version: 1, isActive: true, createdById: null });
    mockRepo.findRubricHistory.mockResolvedValue([v1]);

    const result = await handler.execute(new GetScoringRubricVersionsQuery(programId, ScoringStage.application));

    expect(mockPrisma.admin.findMany).not.toHaveBeenCalled();
    expect(result[0].createdByName).toBeNull();
  });

  it('returns versions newest-first, matching findRubricHistory ordering', async () => {
    const v2 = makeVersion({ id: 'schema-v2', version: 2, isActive: true, createdById: null });
    const v1 = makeVersion({ id: 'schema-v1', version: 1, isActive: false, createdById: null });
    mockRepo.findRubricHistory.mockResolvedValue([v2, v1]);

    const result = await handler.execute(new GetScoringRubricVersionsQuery(programId, ScoringStage.application));

    expect(result.map((r) => r.version)).toEqual([2, 1]);
  });

  it('resolves a slug programId through IProgramRepository.findBySlug before querying history', async () => {
    mockProgramRepo.findBySlug.mockResolvedValue({ id: 'resolved-uuid' });
    mockRepo.findRubricHistory.mockResolvedValue([]);

    await handler.execute(new GetScoringRubricVersionsQuery('my-program-slug', ScoringStage.application));

    expect(mockProgramRepo.findBySlug).toHaveBeenCalledWith('my-program-slug');
    expect(mockRepo.findRubricHistory).toHaveBeenCalledWith('resolved-uuid', ScoringStage.application);
  });
});
