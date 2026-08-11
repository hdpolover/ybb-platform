// services/api/src/modules/applications/application/queries/handlers/get-application-review.handler.spec.ts
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { GetApplicationReviewHandler } from './get-application-review.handler';
import { GetApplicationReviewQuery } from '../get-application-review.query';

const applicationId = 'app-uuid-1';
const programId = 'prog-uuid-1';

function makeApplication() {
  return { id: applicationId, programId, participantId: 'participant-1', status: 'submitted' };
}

function makeActiveRubric(overrides: { stage: ScoringStage; version: number; passThreshold?: number }) {
  return {
    id: `schema-${overrides.stage}-v${overrides.version}`,
    programId,
    stage: overrides.stage,
    name: `${overrides.stage} Rubric`,
    description: null,
    isActive: true,
    version: overrides.version,
    createdById: null,
    passThreshold: new Prisma.Decimal(overrides.passThreshold ?? 75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [
      {
        id: 'cat-1',
        schemaId: `schema-${overrides.stage}-v${overrides.version}`,
        name: 'Essay',
        description: null,
        weight: new Prisma.Decimal(1),
        order: 0,
        legacyId: null,
        criteria: [
          {
            id: 'crit-1',
            categoryId: 'cat-1',
            name: 'Relevance',
            description: null,
            weight: new Prisma.Decimal(1),
            maxScore: new Prisma.Decimal(100),
            order: 0,
            legacyId: null,
          },
        ],
      },
    ],
  };
}

describe('GetApplicationReviewHandler', () => {
  let handler: GetApplicationReviewHandler;
  let mockApplicationRepo: { findById: jest.Mock };
  let mockScoringRubricRepo: { findActiveRubric: jest.Mock };
  let mockPrisma: {
    applicationReview: { findUnique: jest.Mock };
    scoringSchema: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    mockApplicationRepo = { findById: jest.fn().mockResolvedValue(makeApplication()) };
    mockScoringRubricRepo = { findActiveRubric: jest.fn() };
    mockPrisma = {
      applicationReview: { findUnique: jest.fn() },
      scoringSchema: { findUnique: jest.fn() },
    };
    handler = new GetApplicationReviewHandler(
      mockApplicationRepo as any,
      mockScoringRubricRepo as any,
      mockPrisma as any,
    );
  });

  it('throws NotFoundException when the application does not exist', async () => {
    mockApplicationRepo.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.application)),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException (409) when no active rubric exists for that program/stage', async () => {
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(null);
    await expect(
      handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.interview)),
    ).rejects.toThrow(ConflictException);
    await expect(
      handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.interview)),
    ).rejects.toThrow(/Rubric page/);
  });

  it('returns an empty review shaped against the active rubric when none exists yet, with the application-stage gate always open', async () => {
    const activeRubric = makeActiveRubric({ stage: ScoringStage.application, version: 1 });
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(activeRubric);
    mockPrisma.applicationReview.findUnique.mockResolvedValue(null);

    const result = await handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.application));

    expect(result.id).toBeNull();
    expect(result.schemaId).toBe(activeRubric.id);
    expect(result.schemaVersion).toBe(1);
    expect(result.status).toBe('draft');
    expect(result.totalScore).toBe(0);
    expect(result.scoreItems).toEqual([]);
    expect(result.rubric.categories).toHaveLength(1);
    expect(result.hasNewerRubricVersion).toBe(false);
    expect(result.gate).toEqual({
      isOpen: true,
      reason: 'open',
      applicationTotal: null,
      applicationThreshold: null,
    });
  });

  it('returns an existing review resolved against its pinned schema, flagging a newer active version', async () => {
    const activeRubric = makeActiveRubric({ stage: ScoringStage.application, version: 2 });
    const pinnedSchema = makeActiveRubric({ stage: ScoringStage.application, version: 1 });
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(activeRubric);
    mockPrisma.applicationReview.findUnique.mockResolvedValue({
      id: 'review-1',
      applicationId,
      schemaId: pinnedSchema.id,
      reviewerId: 'admin-1',
      stage: ScoringStage.application,
      totalScore: new Prisma.Decimal(42.5),
      notes: 'Looks good',
      status: 'draft',
      overrideById: null,
      overrideReason: null,
      startedAt: new Date(),
      completedAt: null,
      items: [{ id: 'item-1', reviewId: 'review-1', criterionId: 'crit-1', score: new Prisma.Decimal(85), notes: null, legacyId: null }],
    });
    mockPrisma.scoringSchema.findUnique.mockResolvedValue(pinnedSchema);

    const result = await handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.application));

    expect(result.id).toBe('review-1');
    expect(result.schemaId).toBe(pinnedSchema.id);
    expect(result.schemaVersion).toBe(1);
    expect(result.totalScore).toBe(42.5);
    expect(result.scoreItems).toEqual([{ criterionId: 'crit-1', score: 85, notes: null }]);
    expect(result.hasNewerRubricVersion).toBe(true);
  });

  it('interview stage: gate is closed with reason application_draft when the application-stage review is still draft', async () => {
    const interviewRubric = makeActiveRubric({ stage: ScoringStage.interview, version: 1 });
    const applicationRubric = makeActiveRubric({ stage: ScoringStage.application, version: 1, passThreshold: 75 });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? interviewRubric : applicationRubric),
    );
    mockPrisma.applicationReview.findUnique.mockImplementation(({ where }: any) =>
      where.applicationId_stage.stage === ScoringStage.application
        ? Promise.resolve({
            id: 'review-app', applicationId, schemaId: applicationRubric.id, reviewerId: 'admin-1',
            stage: ScoringStage.application, totalScore: new Prisma.Decimal(90), notes: null,
            status: 'draft', overrideById: null, overrideReason: null, startedAt: new Date(),
            completedAt: null, items: [],
          })
        : Promise.resolve(null),
    );

    const result = await handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.interview));

    expect(result.gate).toEqual({
      isOpen: false,
      reason: 'application_draft',
      applicationTotal: 90,
      applicationThreshold: 75,
    });
  });

  it('interview stage: gate is open when the application-stage review is submitted at or above threshold', async () => {
    const interviewRubric = makeActiveRubric({ stage: ScoringStage.interview, version: 1 });
    const applicationRubric = makeActiveRubric({ stage: ScoringStage.application, version: 1, passThreshold: 75 });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? interviewRubric : applicationRubric),
    );
    mockPrisma.applicationReview.findUnique.mockImplementation(({ where }: any) =>
      where.applicationId_stage.stage === ScoringStage.application
        ? Promise.resolve({
            id: 'review-app', applicationId, schemaId: applicationRubric.id, reviewerId: 'admin-1',
            stage: ScoringStage.application, totalScore: new Prisma.Decimal(80), notes: null,
            status: 'submitted', overrideById: null, overrideReason: null, startedAt: new Date(),
            completedAt: new Date(), items: [],
          })
        : Promise.resolve(null),
    );

    const result = await handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.interview));

    expect(result.gate).toEqual({
      isOpen: true,
      reason: 'open',
      applicationTotal: 80,
      applicationThreshold: 75,
    });
  });

  it('tenancy: derives programId from the looked-up application, never from client input, so a wrong-program rubric is never served', async () => {
    // The query only carries applicationId/stage, no programId. Simulate a
    // repo that would return a DIFFERENT (wrong-tenant) rubric if it were
    // ever called with anything other than the application's own programId,
    // to prove the handler cannot be tricked into cross-program lookups.
    const otherProgramRubric = makeActiveRubric({ stage: ScoringStage.application, version: 1 });
    otherProgramRubric.programId = 'some-other-program-id';

    mockScoringRubricRepo.findActiveRubric.mockImplementation((pid: string, stage: ScoringStage) => {
      if (pid !== programId) {
        // Would leak another tenant's rubric if the handler ever passed a
        // programId that didn't come from the fetched application.
        return Promise.resolve(otherProgramRubric);
      }
      return Promise.resolve(makeActiveRubric({ stage, version: 1 }));
    });
    mockPrisma.applicationReview.findUnique.mockResolvedValue(null);

    const result = await handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.application));

    expect(mockScoringRubricRepo.findActiveRubric).toHaveBeenCalledWith(programId, ScoringStage.application);
    expect(result.rubric.programId).toBe(programId);
    expect(result.rubric.programId).not.toBe('some-other-program-id');
  });
});
