// services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { GetScoringRubricsHandler } from './get-scoring-rubrics.handler';
import { GetScoringRubricsQuery } from '../get-scoring-rubrics.query';

const programId = 'prog-uuid-1';

function makeSchema(stage: ScoringStage, version: number) {
  return {
    id: `schema-${stage}-v${version}`,
    programId,
    stage,
    name: `${stage} Rubric`,
    description: null,
    isActive: true,
    version,
    createdById: null,
    passThreshold: new Prisma.Decimal(75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [],
  };
}

describe('GetScoringRubricsHandler', () => {
  let handler: GetScoringRubricsHandler;
  let mockRepo: {
    findActiveRubric: jest.Mock;
    findRubricVersion: jest.Mock;
  };
  let mockProgramRepo: { findBySlug: jest.Mock };

  beforeEach(() => {
    mockRepo = {
      findActiveRubric: jest.fn(),
      findRubricVersion: jest.fn(),
    };
    mockProgramRepo = { findBySlug: jest.fn() };
    handler = new GetScoringRubricsHandler(mockRepo as any, mockProgramRepo as any);
  });

  it('fetches the active rubric for both stages when neither stage nor version is given', async () => {
    mockRepo.findActiveRubric.mockImplementation((_pid, stage) =>
      Promise.resolve(makeSchema(stage, 1)),
    );

    const result = await handler.execute(new GetScoringRubricsQuery(programId));

    expect(mockRepo.findActiveRubric).toHaveBeenCalledWith(programId, ScoringStage.application);
    expect(mockRepo.findActiveRubric).toHaveBeenCalledWith(programId, ScoringStage.interview);
    expect(result.application?.version).toBe(1);
    expect(result.interview?.version).toBe(1);
  });

  it('fetches only the active rubric for the requested stage, leaving the other null', async () => {
    mockRepo.findActiveRubric.mockResolvedValue(makeSchema(ScoringStage.application, 3));

    const result = await handler.execute(new GetScoringRubricsQuery(programId, ScoringStage.application));

    expect(mockRepo.findActiveRubric).toHaveBeenCalledWith(programId, ScoringStage.application);
    expect(mockRepo.findActiveRubric).not.toHaveBeenCalledWith(programId, ScoringStage.interview);
    expect(result.application?.version).toBe(3);
    expect(result.interview).toBeNull();
  });

  it('fetches a specific version via findRubricVersion when stage and version are both given', async () => {
    mockRepo.findRubricVersion.mockResolvedValue(makeSchema(ScoringStage.application, 2));

    const result = await handler.execute(new GetScoringRubricsQuery(programId, ScoringStage.application, 2));

    expect(mockRepo.findRubricVersion).toHaveBeenCalledWith(programId, ScoringStage.application, 2);
    expect(mockRepo.findActiveRubric).not.toHaveBeenCalled();
    expect(result.application?.version).toBe(2);
    expect(result.interview).toBeNull();
  });

  it('throws NotFoundException when the requested version does not exist', async () => {
    mockRepo.findRubricVersion.mockResolvedValue(null);

    await expect(
      handler.execute(new GetScoringRubricsQuery(programId, ScoringStage.application, 99)),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolves a slug programId through IProgramRepository.findBySlug before querying rubrics', async () => {
    mockProgramRepo.findBySlug.mockResolvedValue({ id: 'resolved-uuid' });
    mockRepo.findActiveRubric.mockResolvedValue(null);

    await handler.execute(new GetScoringRubricsQuery('my-program-slug', ScoringStage.application));

    expect(mockProgramRepo.findBySlug).toHaveBeenCalledWith('my-program-slug');
    expect(mockRepo.findActiveRubric).toHaveBeenCalledWith('resolved-uuid', ScoringStage.application);
  });
});
