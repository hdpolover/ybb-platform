import { ScoringStage } from '@prisma/client';
import { ScoringRubricRepository } from './scoring-rubric.repository';
import { UpsertRubricPayload } from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

describe('ScoringRubricRepository', () => {
  let repo: ScoringRubricRepository;
  let mockPrisma: {
    scoringSchema: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    scoringCategory: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    scoringCriterion: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const schemaId = 'schema-uuid-1';
  const programId = 'prog-uuid-1';
  const catId = 'cat-uuid-1';
  const critId = 'crit-uuid-1';

  const makeFullSchema = () => ({
    id: schemaId,
    programId,
    stage: ScoringStage.application,
    name: 'Test Rubric',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [
      {
        id: catId,
        schemaId,
        name: 'Essay',
        description: null,
        weight: 0.6,
        order: 0,
        legacyId: null,
        criteria: [
          {
            id: critId,
            categoryId: catId,
            name: 'Topic Relevance',
            description: null,
            weight: 1.0,
            maxScore: 100,
            order: 0,
            legacyId: null,
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    // $transaction executes the callback synchronously in tests by passing mockPrisma
    mockPrisma = {
      scoringSchema: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      scoringCategory: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      scoringCriterion: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    repo = new ScoringRubricRepository(mockPrisma as any);
  });

  describe('findRubricsByProgramId', () => {
    it('returns rubrics ordered by category/criterion order', async () => {
      const expected = [makeFullSchema()];
      mockPrisma.scoringSchema.findMany.mockResolvedValue(expected);

      const result = await repo.findRubricsByProgramId(programId);

      expect(mockPrisma.scoringSchema.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ programId, deletedAt: null }),
          include: expect.objectContaining({ categories: expect.any(Object) }),
        }),
      );
      expect(result).toEqual(expected);
    });

    it('filters by stage when provided', async () => {
      mockPrisma.scoringSchema.findMany.mockResolvedValue([]);

      await repo.findRubricsByProgramId(programId, ScoringStage.interview);

      expect(mockPrisma.scoringSchema.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ programId, stage: ScoringStage.interview, deletedAt: null }),
        }),
      );
    });
  });

  describe('upsertRubric (create path)', () => {
    it('creates a new schema when none exists for (programId, stage)', async () => {
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(null);
      const created = makeFullSchema();
      mockPrisma.scoringSchema.create.mockResolvedValue(created);
      mockPrisma.scoringCategory.create.mockResolvedValue({
        ...created.categories[0],
        criteria: [],
      });
      mockPrisma.scoringCriterion.create.mockResolvedValue(created.categories[0].criteria[0]);

      // Re-fetch uses findMany({ where: { id: schemaId } }) + rows[0], which is equivalent to
      // findFirst on a primary-key lookup (at most one row is ever returned for a given id).
      mockPrisma.scoringSchema.findMany.mockResolvedValue([created]);

      const payload: UpsertRubricPayload = {
        name: 'Test Rubric',
        categories: [
          {
            name: 'Essay',
            weight: 0.6,
            order: 0,
            criteria: [{ name: 'Topic Relevance', weight: 1.0, maxScore: 100, order: 0 }],
          },
        ],
      };

      await repo.upsertRubric(programId, ScoringStage.application, payload);

      expect(mockPrisma.scoringSchema.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ programId, stage: ScoringStage.application }),
        }),
      );

      // The category create loop must fire once for the single id-less category.
      expect(mockPrisma.scoringCategory.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scoringCategory.create).toHaveBeenCalledWith({
        data: {
          schemaId,
          name: 'Essay',
          description: null,
          weight: 0.6,
          order: 0,
        },
      });

      // The criterion create loop must fire once for the single id-less criterion.
      expect(mockPrisma.scoringCriterion.create).toHaveBeenCalledTimes(1);
      // categoryId comes from the id returned by scoringCategory.create mock (catId)
      expect(mockPrisma.scoringCriterion.create).toHaveBeenCalledWith({
        data: {
          categoryId: catId,
          name: 'Topic Relevance',
          description: null,
          weight: 1.0,
          maxScore: 100,
          order: 0,
        },
      });
    });
  });

  describe('upsertRubric (update path)', () => {
    it('updates the existing schema when one exists for (programId, stage)', async () => {
      const existingSchema = makeFullSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(existingSchema);
      mockPrisma.scoringSchema.update.mockResolvedValue({ ...existingSchema, name: 'Updated' });
      mockPrisma.scoringCategory.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scoringCriterion.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scoringCategory.update.mockResolvedValue(existingSchema.categories[0]);
      mockPrisma.scoringCriterion.update.mockResolvedValue(existingSchema.categories[0].criteria[0]);
      mockPrisma.scoringSchema.findMany.mockResolvedValue([{ ...existingSchema, name: 'Updated' }]);

      const payload: UpsertRubricPayload = {
        name: 'Updated',
        categories: [
          {
            id: catId,
            name: 'Essay',
            weight: 0.6,
            order: 0,
            criteria: [
              { id: critId, name: 'Topic Relevance', weight: 1.0, maxScore: 100, order: 0 },
            ],
          },
        ],
      };

      await repo.upsertRubric(programId, ScoringStage.application, payload);

      expect(mockPrisma.scoringSchema.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: schemaId } }),
      );

      // The category update loop must fire once for the category that carries an id.
      expect(mockPrisma.scoringCategory.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scoringCategory.update).toHaveBeenCalledWith({
        where: { id: catId },
        data: {
          name: 'Essay',
          description: null,
          weight: 0.6,
          order: 0,
        },
      });

      // The criterion update loop must fire once for the criterion that carries an id.
      expect(mockPrisma.scoringCriterion.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scoringCriterion.update).toHaveBeenCalledWith({
        where: { id: critId },
        data: {
          name: 'Topic Relevance',
          description: null,
          weight: 1.0,
          maxScore: 100,
          order: 0,
        },
      });

      // Partial-delete branch: categories not in payload must be purged via notIn.
      expect(mockPrisma.scoringCategory.deleteMany).toHaveBeenCalledWith({
        where: { schemaId, id: { notIn: [catId] } },
      });

      // Partial-delete branch: criteria not in payload must be purged via notIn, keyed by categoryId.
      expect(mockPrisma.scoringCriterion.deleteMany).toHaveBeenCalledWith({
        where: { categoryId: catId, id: { notIn: [critId] } },
      });
    });

    it('deletes categories absent from payload', async () => {
      const existingSchema = makeFullSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(existingSchema);
      mockPrisma.scoringSchema.update.mockResolvedValue(existingSchema);
      mockPrisma.scoringCategory.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.scoringCriterion.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scoringSchema.findMany.mockResolvedValue([existingSchema]);

      const payload: UpsertRubricPayload = {
        categories: [], // all categories removed
      };

      await repo.upsertRubric(programId, ScoringStage.application, payload);

      // When the payload category list is empty, payloadCategoryIds is [] so the implementation
      // passes NO notIn filter -- meaning "delete all categories for this schema".
      // Assert the exact where shape to lock in the all-delete branch (not just that schemaId is present).
      expect(mockPrisma.scoringCategory.deleteMany).toHaveBeenCalledWith({
        where: { schemaId },
      });
    });
  });
});
