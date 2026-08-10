// services/api/src/modules/applications/application/commands/handlers/upsert-application-review.handler.spec.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { UserRole } from '@core/entities/user.entity';
import { UpsertApplicationReviewHandler } from './upsert-application-review.handler';
import { UpsertApplicationReviewCommand } from '../upsert-application-review.command';

const applicationId = 'app-uuid-1';
const programId = 'prog-uuid-1';

function makeApplication() {
  return { id: applicationId, programId, participantId: 'participant-1', status: 'submitted' };
}

// Achievement 40%, Essay 60%; single criterion each, weight 1.0, maxScore 100 — mirrors the
// legacy-derived seed shape closely enough to exercise the real weighted-total formula.
function makeRubric(stage: ScoringStage, overrides?: { version?: number; passThreshold?: number; maxScore?: number }) {
  const version = overrides?.version ?? 1;
  return {
    id: `schema-${stage}-v${version}`,
    programId,
    stage,
    name: `${stage} Rubric`,
    description: null,
    isActive: true,
    version,
    createdById: null,
    passThreshold: new Prisma.Decimal(overrides?.passThreshold ?? 75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [
      {
        id: 'cat-achievement', schemaId: `schema-${stage}-v${version}`, name: 'Achievement', description: null,
        weight: new Prisma.Decimal(0.4), order: 0, legacyId: null,
        criteria: [
          { id: 'crit-leadership', categoryId: 'cat-achievement', name: 'Leadership', description: null, weight: new Prisma.Decimal(1), maxScore: new Prisma.Decimal(overrides?.maxScore ?? 100), order: 0, legacyId: null },
        ],
      },
      {
        id: 'cat-essay', schemaId: `schema-${stage}-v${version}`, name: 'Essay', description: null,
        weight: new Prisma.Decimal(0.6), order: 1, legacyId: null,
        criteria: [
          { id: 'crit-relevance', categoryId: 'cat-essay', name: 'Relevance', description: null, weight: new Prisma.Decimal(1), maxScore: new Prisma.Decimal(overrides?.maxScore ?? 100), order: 0, legacyId: null },
        ],
      },
    ],
  };
}

describe('UpsertApplicationReviewHandler', () => {
  let handler: UpsertApplicationReviewHandler;
  let mockApplicationRepo: { findById: jest.Mock };
  let mockScoringRubricRepo: { findActiveRubric: jest.Mock };
  let mockGetApplicationReviewHandler: { execute: jest.Mock };
  let mockTx: {
    applicationReview: { upsert: jest.Mock; findUnique: jest.Mock };
    applicationScoreItem: { deleteMany: jest.Mock; createMany: jest.Mock };
    participantApplication: { update: jest.Mock };
  };
  let mockPrisma: {
    applicationReview: { findUnique: jest.Mock };
    scoringSchema: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  const validPayload = {
    status: 'submitted' as const,
    items: [
      { criterionId: 'crit-leadership', score: 80 },
      { criterionId: 'crit-relevance', score: 90 },
    ],
  };
  // total = 80*1*0.4 + 90*1*0.6 = 32 + 54 = 86

  beforeEach(() => {
    mockApplicationRepo = { findById: jest.fn().mockResolvedValue(makeApplication()) };
    mockScoringRubricRepo = { findActiveRubric: jest.fn() };
    mockGetApplicationReviewHandler = { execute: jest.fn().mockResolvedValue({ id: 'review-1' }) };
    mockTx = {
      applicationReview: {
        upsert: jest.fn().mockResolvedValue({ id: 'review-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      applicationScoreItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      participantApplication: { update: jest.fn() },
    };
    mockPrisma = {
      applicationReview: { findUnique: jest.fn().mockResolvedValue(null) },
      scoringSchema: { findUnique: jest.fn() },
      $transaction: jest.fn((cb) => cb(mockTx)),
    };
    handler = new UpsertApplicationReviewHandler(
      mockApplicationRepo as any,
      mockScoringRubricRepo as any,
      mockGetApplicationReviewHandler as any,
      mockPrisma as any,
    );
  });

  function stub(stage: ScoringStage, rubricOverrides?: Parameters<typeof makeRubric>[1]) {
    const rubric = makeRubric(stage, rubricOverrides);
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(rubric);
    mockPrisma.scoringSchema.findUnique.mockResolvedValue(rubric);
    return rubric;
  }

  it('throws NotFoundException when the application does not exist', async () => {
    mockApplicationRepo.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, validPayload)),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException (409) when no active rubric exists and no review is pinned yet', async () => {
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(null);
    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, validPayload)),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException (400) with a field-level error when a criterionId is not in the pinned schema', async () => {
    stub(ScoringStage.application);
    const payload = { status: 'draft' as const, items: [{ criterionId: 'crit-not-in-schema', score: 50 }] };

    try {
      await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));
      fail('expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string }> };
      expect(response.errors[0].path).toBe('items[0].criterionId');
    }
  });

  it('throws BadRequestException (400) with a field-level error when a score exceeds maxScore', async () => {
    stub(ScoringStage.application);
    const payload = { status: 'draft' as const, items: [{ criterionId: 'crit-leadership', score: 150 }] };

    try {
      await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));
      fail('expected BadRequestException');
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string }> };
      expect(response.errors[0].path).toBe('items[0].score');
    }
  });

  it('rejects a weighted total that would overflow Decimal(5,2) with 400 instead of clamping', async () => {
    stub(ScoringStage.application, { maxScore: 5000 });
    const payload = {
      status: 'draft' as const,
      items: [
        { criterionId: 'crit-leadership', score: 5000 },
        { criterionId: 'crit-relevance', score: 5000 },
      ],
    };

    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload)),
    ).rejects.toThrow(BadRequestException);
  });

  it('draft: persists items and totalScore but does not touch ParticipantApplication', async () => {
    stub(ScoringStage.application);
    const payload = { ...validPayload, status: 'draft' as const };

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));

    expect(mockTx.applicationReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'draft', totalScore: 86, completedAt: null }),
        update: expect.objectContaining({ status: 'draft', totalScore: 86, completedAt: null }),
      }),
    );
    expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
  });

  it('submitted at the application stage: mirrors totalScore and go_to_interview onto ParticipantApplication when at/above threshold', async () => {
    stub(ScoringStage.application, { passThreshold: 75 });

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, validPayload));

    expect(mockTx.applicationReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: 'submitted', totalScore: 86 }) }),
    );
    expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
      where: { id: applicationId },
      data: { scoreTotal: 86, scoreStatus: 'go_to_interview' },
    });
  });

  it('interview PUT on a closed gate: 409 for an ADMIN', async () => {
    stub(ScoringStage.interview);
    mockPrisma.applicationReview.findUnique.mockResolvedValue({
      id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90),
    });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );

    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'admin-1', UserRole.ADMIN, validPayload)),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('interview PUT on a closed gate: succeeds for a SUPER_ADMIN with an override reason and records it', async () => {
    stub(ScoringStage.interview);
    mockPrisma.applicationReview.findUnique.mockResolvedValue({
      id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90),
    });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );
    const payload = { ...validPayload, overrideReason: 'Panel requested an early interview.' };

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'super-1', UserRole.SUPER_ADMIN, payload));

    expect(mockTx.applicationReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ overrideById: 'super-1', overrideReason: 'Panel requested an early interview.' }),
      }),
    );
  });

  it('interview PUT on a closed gate: rejected for a SUPER_ADMIN without an override reason', async () => {
    stub(ScoringStage.interview);
    mockPrisma.applicationReview.findUnique.mockResolvedValue({
      id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90),
    });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );

    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'super-1', UserRole.SUPER_ADMIN, validPayload)),
    ).rejects.toThrow(ConflictException);
  });
});
