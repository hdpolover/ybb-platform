// services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { UpsertScoringRubricHandler } from './upsert-scoring-rubric.handler';
import { UpsertScoringRubricCommand } from '../upsert-scoring-rubric.command';

const programId = 'prog-uuid-1';

const validPayload = {
  name: 'Application Rubric',
  passThreshold: 75,
  categories: [
    {
      name: 'Achievement',
      weight: 0.4,
      order: 0,
      criteria: [{ name: 'Leadership', weight: 1.0, maxScore: 100, order: 0 }],
    },
    {
      name: 'Essay',
      weight: 0.6,
      order: 1,
      criteria: [{ name: 'Relevance', weight: 1.0, maxScore: 100, order: 0 }],
    },
  ],
};

const fakeMintedResult = {
  id: 'schema-1',
  programId,
  stage: ScoringStage.application,
  name: 'Application Rubric',
  description: null,
  isActive: true,
  version: 2,
  createdById: 'admin-1',
  passThreshold: new Prisma.Decimal(75),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  legacyId: null,
  categories: [
    {
      id: 'cat-1',
      schemaId: 'schema-1',
      name: 'Achievement',
      description: null,
      weight: new Prisma.Decimal(0.4),
      order: 0,
      legacyId: null,
      criteria: [
        {
          id: 'crit-1',
          categoryId: 'cat-1',
          name: 'Leadership',
          description: null,
          weight: new Prisma.Decimal(1.0),
          maxScore: new Prisma.Decimal(100),
          order: 0,
          legacyId: null,
        },
      ],
    },
    {
      id: 'cat-2',
      schemaId: 'schema-1',
      name: 'Essay',
      description: null,
      weight: new Prisma.Decimal(0.6),
      order: 1,
      legacyId: null,
      criteria: [
        {
          id: 'crit-2',
          categoryId: 'cat-2',
          name: 'Relevance',
          description: null,
          weight: new Prisma.Decimal(1.0),
          maxScore: new Prisma.Decimal(100),
          order: 0,
          legacyId: null,
        },
      ],
    },
  ],
};

function makeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['programId', 'stage', 'version'] },
  });
}

describe('UpsertScoringRubricHandler', () => {
  let handler: UpsertScoringRubricHandler;
  let mockRepo: { mintRubricVersion: jest.Mock };

  beforeEach(() => {
    mockRepo = { mintRubricVersion: jest.fn().mockResolvedValue(fakeMintedResult) };
    handler = new UpsertScoringRubricHandler(mockRepo as any);
  });

  it('mints a version and returns a RubricDto carrying version and passThreshold', async () => {
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, validPayload, 'admin-1');
    const result = await handler.execute(cmd);

    expect(mockRepo.mintRubricVersion).toHaveBeenCalledWith(
      programId,
      ScoringStage.application,
      validPayload,
      'admin-1',
    );
    expect(result.id).toBe('schema-1');
    expect(result.version).toBe(2);
    expect(result.passThreshold).toBe(75);
    expect(result.categories).toHaveLength(2);
  });

  it('throws BadRequestException with field-level errors when category weights do not sum to 1.0', async () => {
    const payload = {
      ...validPayload,
      categories: [
        { ...validPayload.categories[0], weight: 0.3 },
        validPayload.categories[1],
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');

    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
    expect(mockRepo.mintRubricVersion).not.toHaveBeenCalled();

    try {
      await handler.execute(cmd);
      fail('expected BadRequestException');
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string }> };
      expect(response.errors[0].path).toBe('categories');
    }
  });

  it("throws BadRequestException with field-level errors when a category's criteria do not sum to 1.0", async () => {
    const payload = {
      ...validPayload,
      categories: [
        {
          ...validPayload.categories[0],
          criteria: [
            { name: 'Leadership', weight: 0.5, maxScore: 100, order: 0 },
            { name: 'Initiative', weight: 0.3, maxScore: 100, order: 1 },
          ],
        },
        validPayload.categories[1],
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');

    try {
      await handler.execute(cmd);
      fail('expected BadRequestException');
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string }> };
      expect(response.errors[0].path).toBe('categories[0].criteria');
    }
  });

  it('throws BadRequestException when a category weight is negative', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: -0.1, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a criterion maxScore is zero or negative', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: 1, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 0, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a category name is empty', async () => {
    const payload = {
      categories: [
        { name: '', weight: 1, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('retries once on a version-conflict P2002 and succeeds if the retry does not collide', async () => {
    mockRepo.mintRubricVersion
      .mockRejectedValueOnce(makeP2002())
      .mockResolvedValueOnce(fakeMintedResult);

    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, validPayload, 'admin-1');
    const result = await handler.execute(cmd);

    expect(mockRepo.mintRubricVersion).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('schema-1');
  });

  it('throws ConflictException when the version-conflict P2002 persists after one retry', async () => {
    mockRepo.mintRubricVersion.mockRejectedValue(makeP2002());

    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, validPayload, 'admin-1');

    await expect(handler.execute(cmd)).rejects.toThrow(ConflictException);
    expect(mockRepo.mintRubricVersion).toHaveBeenCalledTimes(2);
  });

  it('does not retry and rethrows non-conflict errors unchanged', async () => {
    const dbError = new Error('connection reset');
    mockRepo.mintRubricVersion.mockRejectedValue(dbError);

    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, validPayload, 'admin-1');

    await expect(handler.execute(cmd)).rejects.toThrow('connection reset');
    expect(mockRepo.mintRubricVersion).toHaveBeenCalledTimes(1);
  });
});
