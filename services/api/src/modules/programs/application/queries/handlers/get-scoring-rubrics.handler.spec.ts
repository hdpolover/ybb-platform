import { ScoringStage } from '@prisma/client';
import { GetScoringRubricsHandler } from './get-scoring-rubrics.handler';
import { GetScoringRubricsQuery } from '../get-scoring-rubrics.query';

const programId = 'prog-uuid-1';
const schemaId = 'schema-uuid-1';

const makeSchema = (stage: ScoringStage) => ({
  id: schemaId,
  programId,
  stage,
  name: `${stage} Rubric`,
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  legacyId: null,
  categories: [
    {
      id: 'cat-1',
      schemaId,
      name: 'Essay',
      description: null,
      weight: 0.6,
      order: 0,
      legacyId: null,
      criteria: [
        {
          id: 'crit-1',
          categoryId: 'cat-1',
          name: 'Relevance',
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

describe('GetScoringRubricsHandler', () => {
  let handler: GetScoringRubricsHandler;
  let mockRepo: { findRubricsByProgramId: jest.Mock };
  let mockProgramRepo: { findBySlug: jest.Mock; findById: jest.Mock };

  beforeEach(() => {
    mockRepo = { findRubricsByProgramId: jest.fn() };
    mockProgramRepo = {
      findBySlug: jest.fn(),
      findById: jest.fn().mockResolvedValue({ id: programId }),
    };
    handler = new GetScoringRubricsHandler(mockRepo as any, mockProgramRepo as any);
  });

  it('returns { application, interview } when both stages exist', async () => {
    mockProgramRepo.findById.mockResolvedValue({ id: programId });
    mockRepo.findRubricsByProgramId.mockResolvedValue([
      makeSchema(ScoringStage.application),
      makeSchema(ScoringStage.interview),
    ]);

    const result = await handler.execute(new GetScoringRubricsQuery(programId));

    expect(result.application).not.toBeNull();
    expect(result.interview).not.toBeNull();
    expect(result.application!.stage).toBe('application');
    expect(result.interview!.stage).toBe('interview');
  });

  it('returns null for a stage that has no rubric', async () => {
    mockRepo.findRubricsByProgramId.mockResolvedValue([makeSchema(ScoringStage.application)]);

    const result = await handler.execute(new GetScoringRubricsQuery(programId));

    expect(result.application).not.toBeNull();
    expect(result.interview).toBeNull();
  });

  it('maps Decimal weight/maxScore to numbers on criteria', async () => {
    const { Prisma } = await import('@prisma/client');
    const schema = makeSchema(ScoringStage.application);
    schema.categories[0].weight = new Prisma.Decimal(0.6) as any;
    schema.categories[0].criteria[0].weight = new Prisma.Decimal(1.0) as any;
    schema.categories[0].criteria[0].maxScore = new Prisma.Decimal(100) as any;

    mockRepo.findRubricsByProgramId.mockResolvedValue([schema]);

    const result = await handler.execute(new GetScoringRubricsQuery(programId));

    expect(typeof result.application!.categories[0].weight).toBe('number');
    expect(typeof result.application!.categories[0].criteria[0].maxScore).toBe('number');
  });

  it('resolves slug to UUID when a non-UUID programId is provided', async () => {
    mockProgramRepo.findBySlug.mockResolvedValue({ id: programId });
    mockRepo.findRubricsByProgramId.mockResolvedValue([]);

    await handler.execute(new GetScoringRubricsQuery('my-program-slug'));

    expect(mockProgramRepo.findBySlug).toHaveBeenCalledWith('my-program-slug');
    expect(mockRepo.findRubricsByProgramId).toHaveBeenCalledWith(programId, undefined);
  });
});
