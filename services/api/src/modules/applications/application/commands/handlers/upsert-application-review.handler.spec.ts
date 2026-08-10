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

// Achievement 40%, Essay 60%; single criterion each, weight 1.0, maxScore 100. Mirrors the
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

// A distinct schema shape (0.5/0.5 category weights, same criterionIds) used only to prove
// the schema-pin race guard rescoring uses whatever schema is actually persisted, not the
// one this call speculatively resolved.
function makeAltRubric(schemaId: string) {
  return {
    id: schemaId,
    programId,
    stage: ScoringStage.application,
    name: 'Alt Rubric (concurrent winner)',
    description: null,
    isActive: true,
    version: 2,
    createdById: null,
    passThreshold: new Prisma.Decimal(75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [
      {
        id: 'cat-achievement', schemaId, name: 'Achievement', description: null,
        weight: new Prisma.Decimal(0.5), order: 0, legacyId: null,
        criteria: [
          { id: 'crit-leadership', categoryId: 'cat-achievement', name: 'Leadership', description: null, weight: new Prisma.Decimal(1), maxScore: new Prisma.Decimal(100), order: 0, legacyId: null },
        ],
      },
      {
        id: 'cat-essay', schemaId, name: 'Essay', description: null,
        weight: new Prisma.Decimal(0.5), order: 1, legacyId: null,
        criteria: [
          { id: 'crit-relevance', categoryId: 'cat-essay', name: 'Relevance', description: null, weight: new Prisma.Decimal(1), maxScore: new Prisma.Decimal(100), order: 0, legacyId: null },
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
    applicationReview: { upsert: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    applicationScoreItem: { deleteMany: jest.Mock; createMany: jest.Mock };
    participantApplication: { update: jest.Mock };
    scoringSchema: { findUnique: jest.Mock };
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
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      applicationScoreItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      participantApplication: { update: jest.fn() },
      scoringSchema: { findUnique: jest.fn() },
    };
    mockPrisma = {
      applicationReview: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
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
    // Ties the upsert's returned schemaId to the schema this call actually pinned against,
    // so the schema-pin race guard does not spuriously fire in tests that are not exercising it.
    mockTx.applicationReview.upsert.mockResolvedValue({ id: 'review-1', schemaId: rubric.id });
    return rubric;
  }

  // Makes mockPrisma.applicationReview.findUnique discriminate by the `where` clause's
  // stage, instead of a blanket mockResolvedValue that would answer identically for the
  // schema-pin lookup (own stage) and the interview gate's lookup (application stage).
  function stubReviewLookups(options: { applicationStageReview?: unknown; ownStageReview?: unknown } = {}) {
    mockPrisma.applicationReview.findUnique.mockImplementation(({ where }: any) => {
      const stage = where.applicationId_stage.stage;
      if (stage === ScoringStage.application) {
        return Promise.resolve(options.applicationStageReview ?? null);
      }
      return Promise.resolve(options.ownStageReview ?? null);
    });
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

  it('throws BadRequestException (400) when a score is NaN instead of silently passing every range guard', async () => {
    stub(ScoringStage.application);
    const payload = { status: 'draft' as const, items: [{ criterionId: 'crit-leadership', score: Number.NaN }] };

    try {
      await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));
      fail('expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string }> };
      expect(response.errors[0].path).toBe('items[0].score');
    }
  });

  it('throws BadRequestException (400) naming the duplicated criterion instead of letting createMany hit P2002', async () => {
    stub(ScoringStage.application);
    const payload = {
      status: 'draft' as const,
      items: [
        { criterionId: 'crit-leadership', score: 80 },
        { criterionId: 'crit-leadership', score: 90 },
      ],
    };

    try {
      await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));
      fail('expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string; message: string }> };
      expect(response.errors[0].message).toContain('crit-leadership');
    }
    expect(mockTx.applicationScoreItem.createMany).not.toHaveBeenCalled();
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

  it('draft: a partial submission (missing a required criterion) is accepted, since drafts may be incomplete', async () => {
    stub(ScoringStage.application);
    const payload = { status: 'draft' as const, items: [{ criterionId: 'crit-leadership', score: 80 }] };

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));

    // total = 80*1*0.4 (essay criterion absent, defaults to 0 per calculateWeightedTotal) = 32
    expect(mockTx.applicationReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: 'draft', totalScore: 32 }) }),
    );
    expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
  });

  it('submitted: a partial submission (missing a required criterion) is rejected 400 naming the missing criterion, instead of silently scoring it as 0 and wrongly rejecting a real applicant', async () => {
    stub(ScoringStage.application, { passThreshold: 75 });
    const payload = { status: 'submitted' as const, items: [{ criterionId: 'crit-leadership', score: 80 }] };

    try {
      await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));
      fail('expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string; message: string }> };
      expect(response.errors.some((err) => err.message.includes('crit-relevance'))).toBe(true);
    }
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
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

  it('schema-pin race: rescoring uses whatever schema the transaction actually persisted, not the one this call speculated', async () => {
    stub(ScoringStage.application);
    const winnerSchemaId = 'schema-application-v2-concurrent-winner';
    const altSchema = makeAltRubric(winnerSchemaId);

    // Simulate a concurrent first submission winning the create with a different schema:
    // the upsert returns a row already pinned to `winnerSchemaId`, not the schema this call
    // speculatively resolved via findActiveRubric/scoringSchema.findUnique above.
    mockTx.applicationReview.upsert.mockResolvedValue({ id: 'review-1', schemaId: winnerSchemaId });
    mockTx.scoringSchema.findUnique.mockResolvedValue(altSchema);

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, validPayload));

    // total against altSchema (0.5/0.5 weights) = 80*0.5 + 90*0.5 = 85, not 86.
    expect(mockTx.scoringSchema.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: winnerSchemaId } }),
    );
    expect(mockTx.applicationReview.update).toHaveBeenCalledWith({ where: { id: 'review-1' }, data: { totalScore: 85 } });
    expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
      where: { id: applicationId },
      data: { scoreTotal: 85, scoreStatus: 'go_to_interview' },
    });
  });

  it('interview PUT on a closed gate: 409 for an ADMIN', async () => {
    stub(ScoringStage.interview);
    stubReviewLookups({ applicationStageReview: { id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90) } });
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
    stubReviewLookups({ applicationStageReview: { id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90) } });
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
    stubReviewLookups({ applicationStageReview: { id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90) } });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );

    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'super-1', UserRole.SUPER_ADMIN, validPayload)),
    ).rejects.toThrow(ConflictException);
  });

  it('interview PUT on a closed gate (below_threshold, not just application_draft): 409 for an ADMIN', async () => {
    stub(ScoringStage.interview);
    // Application stage was submitted, but its total is below the application stage's own
    // passThreshold, so the gate reason is `below_threshold` rather than `application_draft`.
    stubReviewLookups({ applicationStageReview: { id: 'review-app', schemaId: 'schema-application-v1', status: 'submitted', totalScore: new Prisma.Decimal(50) } });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );

    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'admin-1', UserRole.ADMIN, validPayload)),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('interview draft save: does not enforce the gate even when it is closed, so an admin can draft before the gate opens', async () => {
    stub(ScoringStage.interview);
    stubReviewLookups({ applicationStageReview: { id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90) } });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );
    const payload = { ...validPayload, status: 'draft' as const };

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'admin-1', UserRole.ADMIN, payload));

    expect(mockTx.applicationReview.upsert).toHaveBeenCalled();
    expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
  });

  it('submitted at the interview stage: mirrors totalScore and finalist onto ParticipantApplication when at/above threshold', async () => {
    stub(ScoringStage.interview, { passThreshold: 75 });
    stubReviewLookups({ applicationStageReview: { id: 'review-app', schemaId: 'schema-application-v1', status: 'submitted', totalScore: new Prisma.Decimal(90) } });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview, { passThreshold: 75 }) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'admin-1', UserRole.ADMIN, validPayload));

    expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
      where: { id: applicationId },
      data: { scoreTotal: 86, scoreStatus: 'finalist' },
    });
  });

  it('submitted at the interview stage: mirrors totalScore and not_selected onto ParticipantApplication when below threshold', async () => {
    stub(ScoringStage.interview, { passThreshold: 75 });
    stubReviewLookups({ applicationStageReview: { id: 'review-app', schemaId: 'schema-application-v1', status: 'submitted', totalScore: new Prisma.Decimal(90) } });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview, { passThreshold: 75 }) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );
    const payload = { status: 'submitted' as const, items: [{ criterionId: 'crit-leadership', score: 10 }, { criterionId: 'crit-relevance', score: 10 }] };
    // total = 10*0.4 + 10*0.6 = 10, below the interview stage's threshold of 75.

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'admin-1', UserRole.ADMIN, payload));

    expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
      where: { id: applicationId },
      data: { scoreTotal: 10, scoreStatus: 'not_selected' },
    });
  });
});
