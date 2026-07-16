import { BadRequestException } from '@nestjs/common';
import { ScoringStage } from '@prisma/client';
import { UpsertScoringRubricHandler } from './upsert-scoring-rubric.handler';
import { UpsertScoringRubricCommand } from '../upsert-scoring-rubric.command';

const programId = 'prog-uuid-1';

const validPayload = {
  name: 'Application Rubric',
  categories: [
    {
      name: 'Essay',
      weight: 0.6,
      order: 0,
      criteria: [{ name: 'Relevance', weight: 1.0, maxScore: 100, order: 0 }],
    },
  ],
};

const fakeResult = {
  id: 'schema-1',
  programId,
  stage: ScoringStage.application,
  name: 'Application Rubric',
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  legacyId: null,
  categories: [
    {
      id: 'cat-1',
      schemaId: 'schema-1',
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
};

describe('UpsertScoringRubricHandler', () => {
  let handler: UpsertScoringRubricHandler;
  let mockRepo: { upsertRubric: jest.Mock };

  beforeEach(() => {
    mockRepo = { upsertRubric: jest.fn().mockResolvedValue(fakeResult) };
    handler = new UpsertScoringRubricHandler(mockRepo as any);
  });

  it('calls upsertRubric with the correct arguments and returns a RubricDto', async () => {
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, validPayload);
    const result = await handler.execute(cmd);

    expect(mockRepo.upsertRubric).toHaveBeenCalledWith(
      programId,
      ScoringStage.application,
      validPayload,
    );
    expect(result.id).toBe('schema-1');
    expect(result.categories).toHaveLength(1);
  });

  it('throws BadRequestException when a category weight is negative', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: -0.1, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a criterion maxScore is zero', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 0, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a criterion maxScore is negative', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: -10, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a category name is empty', async () => {
    const payload = {
      categories: [
        { name: '', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });
});
