// services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts
import { Prisma, ScoringStage } from '@prisma/client';
import { ScoringRubricRepository } from './scoring-rubric.repository';
import { UpsertRubricPayload } from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

describe('ScoringRubricRepository', () => {
  let repo: ScoringRubricRepository;
  let mockPrisma: {
    scoringSchema: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      aggregate: jest.Mock;
    };
    scoringCategory: { create: jest.Mock };
    scoringCriterion: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const programId = 'prog-uuid-1';
  const activeSchemaId = 'schema-uuid-v1';
  const catId = 'cat-uuid-1';
  const critId = 'crit-uuid-1';

  const makeActiveSchema = () => ({
    id: activeSchemaId,
    programId,
    stage: ScoringStage.application,
    name: 'Test Rubric',
    description: null,
    isActive: true,
    version: 1,
    createdById: null,
    passThreshold: new Prisma.Decimal(75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [
      {
        id: catId,
        schemaId: activeSchemaId,
        name: 'Essay',
        description: null,
        weight: new Prisma.Decimal(0.6),
        order: 0,
        legacyId: null,
        criteria: [
          {
            id: critId,
            categoryId: catId,
            name: 'Topic Relevance',
            description: null,
            weight: new Prisma.Decimal(1.0),
            maxScore: new Prisma.Decimal(100),
            order: 0,
            legacyId: null,
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    mockPrisma = {
      scoringSchema: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      scoringCategory: { create: jest.fn() },
      scoringCriterion: { create: jest.fn() },
      // $transaction executes the callback synchronously in tests, passing mockPrisma as `tx`.
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    repo = new ScoringRubricRepository(mockPrisma as any);
  });

  describe('findActiveRubric', () => {
    it('returns the active version for a program/stage', async () => {
      const active = makeActiveSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(active);

      const result = await repo.findActiveRubric(programId, ScoringStage.application);

      expect(mockPrisma.scoringSchema.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId, stage: ScoringStage.application, isActive: true, deletedAt: null },
        }),
      );
      expect(result).toEqual(active);
    });

    it('returns null when no active rubric exists', async () => {
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(null);
      const result = await repo.findActiveRubric(programId, ScoringStage.interview);
      expect(result).toBeNull();
    });
  });

  describe('findRubricVersion', () => {
    it('returns the specific version regardless of active status', async () => {
      const version2 = { ...makeActiveSchema(), id: 'schema-uuid-v2', version: 2, isActive: true };
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(version2);

      const result = await repo.findRubricVersion(programId, ScoringStage.application, 2);

      expect(mockPrisma.scoringSchema.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId, stage: ScoringStage.application, version: 2, deletedAt: null },
        }),
      );
      expect(result).toEqual(version2);
    });
  });

  describe('findRubricHistory', () => {
    it('returns all versions ordered by version descending', async () => {
      const rows = [{ ...makeActiveSchema(), version: 2 }, { ...makeActiveSchema(), version: 1 }];
      mockPrisma.scoringSchema.findMany.mockResolvedValue(rows);

      const result = await repo.findRubricHistory(programId, ScoringStage.application);

      expect(mockPrisma.scoringSchema.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId, stage: ScoringStage.application, deletedAt: null },
          orderBy: { version: 'desc' },
        }),
      );
      expect(result).toEqual(rows);
    });
  });

  describe('mintRubricVersion', () => {
    const payload: UpsertRubricPayload = {
      name: 'Test Rubric',
      passThreshold: 75,
      categories: [
        {
          name: 'Essay',
          weight: 0.6,
          order: 0,
          criteria: [{ name: 'Topic Relevance', weight: 1.0, maxScore: 100, order: 0 }],
        },
      ],
    };

    it('creates version 1 when no active rubric exists yet', async () => {
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(null);
      mockPrisma.scoringSchema.aggregate.mockResolvedValue({ _max: { version: null } });
      const fullSchema = makeActiveSchema();
      const created = { ...fullSchema, categories: [] };
      mockPrisma.scoringSchema.create.mockResolvedValue(created);
      mockPrisma.scoringCategory.create.mockResolvedValue({ ...fullSchema.categories[0], id: catId, criteria: [] });
      mockPrisma.scoringCriterion.create.mockResolvedValue({ id: critId });
      mockPrisma.scoringSchema.findMany.mockResolvedValue([fullSchema]);

      const result = await repo.mintRubricVersion(programId, ScoringStage.application, payload, 'admin-1');

      expect(mockPrisma.scoringSchema.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            programId,
            stage: ScoringStage.application,
            version: 1,
            isActive: true,
            createdById: 'admin-1',
            passThreshold: 75,
          }),
        }),
      );
      expect(result.version).toBe(1);
    });

    it('mints version 2 and flips version 1 inactive when the payload differs from the active version', async () => {
      const active = makeActiveSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(active);
      mockPrisma.scoringSchema.aggregate.mockResolvedValue({ _max: { version: 1 } });
      const changedPayload: UpsertRubricPayload = {
        ...payload,
        categories: [
          {
            ...payload.categories[0],
            criteria: [{ name: 'Topic Relevance', weight: 0.9, maxScore: 100, order: 0 }],
          },
        ],
      };
      const createdV2 = { ...active, id: 'schema-uuid-v2', version: 2 };
      mockPrisma.scoringSchema.create.mockResolvedValue(createdV2);
      mockPrisma.scoringCategory.create.mockResolvedValue({ ...active.categories[0], criteria: [] });
      mockPrisma.scoringCriterion.create.mockResolvedValue(active.categories[0].criteria[0]);
      mockPrisma.scoringSchema.findMany.mockResolvedValue([createdV2]);

      const result = await repo.mintRubricVersion(programId, ScoringStage.application, changedPayload, 'admin-1');

      expect(mockPrisma.scoringSchema.update).toHaveBeenCalledWith({
        where: { id: activeSchemaId },
        data: { isActive: false },
      });
      expect(mockPrisma.scoringSchema.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 2, isActive: true }) }),
      );
      expect(result.version).toBe(2);

      // Deactivating the old active row must happen before the new active row is
      // inserted, or the partial unique index scoring_schemas_one_active_per_program_stage_uidx
      // (one active row per program/stage) rejects the insert.
      const updateOrder = mockPrisma.scoringSchema.update.mock.invocationCallOrder[0];
      const createOrder = mockPrisma.scoringSchema.create.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(createOrder);
    });

    it('returns the existing active version unchanged and mints nothing when the payload is semantically identical', async () => {
      const active = makeActiveSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(active);

      const result = await repo.mintRubricVersion(programId, ScoringStage.application, payload, 'admin-1');

      expect(mockPrisma.scoringSchema.create).not.toHaveBeenCalled();
      expect(mockPrisma.scoringSchema.update).not.toHaveBeenCalled();
      expect(mockPrisma.scoringSchema.aggregate).not.toHaveBeenCalled();
      expect(result).toEqual(active);
    });

    it('skips past a soft-deleted schema occupying a version number: next version is MAX(version)+1 across all rows, including deleted ones', async () => {
      // No active rubric right now, but versions 1-3 have already been used up
      // (version 3 is soft-deleted, so it is invisible to findActiveRubric but
      // still reserves its number via the unbounded unique constraint).
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(null);
      mockPrisma.scoringSchema.aggregate.mockResolvedValue({ _max: { version: 3 } });
      const fullSchema = { ...makeActiveSchema(), version: 4 };
      const created = { ...fullSchema, categories: [] };
      mockPrisma.scoringSchema.create.mockResolvedValue(created);
      mockPrisma.scoringCategory.create.mockResolvedValue({ ...fullSchema.categories[0], id: catId, criteria: [] });
      mockPrisma.scoringCriterion.create.mockResolvedValue({ id: critId });
      mockPrisma.scoringSchema.findMany.mockResolvedValue([fullSchema]);

      const result = await repo.mintRubricVersion(programId, ScoringStage.application, payload, 'admin-1');

      // The aggregate query that computes the next version must NOT filter on
      // deletedAt or isActive: soft-deleted rows still reserve their version
      // number under @@unique([programId, stage, version]).
      expect(mockPrisma.scoringSchema.aggregate).toHaveBeenCalledWith({
        where: { programId, stage: ScoringStage.application },
        _max: { version: true },
      });
      expect(mockPrisma.scoringSchema.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 4, isActive: true }),
        }),
      );
      expect(result.version).toBe(4);
    });
  });
});
