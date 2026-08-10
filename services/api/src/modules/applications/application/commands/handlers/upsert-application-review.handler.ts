// services/api/src/modules/applications/application/commands/handlers/upsert-application-review.handler.ts
import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma, ScoringStage, ScoreStatus } from '@prisma/client';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
} from '@core/interfaces/repositories/scoring-rubric.repository.interface';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UserRole } from '@core/entities/user.entity';
import {
  calculateWeightedTotal,
  resolveStageOutcome,
  evaluateInterviewGate,
  WeightValidationError,
  WeightedCategory,
} from '@modules/scoring/domain/scoring-calculation';
import { GetApplicationReviewHandler } from '../../queries/handlers/get-application-review.handler';
import { GetApplicationReviewQuery } from '../../queries/get-application-review.query';
import { ApplicationReviewResponseDto } from '../../dto/application-review-response.dto';
import { UpsertApplicationReviewCommand, UpsertApplicationReviewItemDto } from '../upsert-application-review.command';

// Decimal(5,2) columns (total_score, pass_threshold) top out at 999.99. A rubric with valid
// weights (each level sums to 1.0) can still overflow this if an admin sets an oversized
// maxScore on a criterion — reject before Postgres ever sees it, per the VarChar/Decimal
// overflow defect class already hit three times in this codebase.
const MAX_DECIMAL_5_2 = 999.99;

const SCHEMA_CATEGORIES_INCLUDE = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: { criteria: { orderBy: { order: 'asc' as const } } },
  },
};

function toNumber(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

function toWeightedCategories(schema: ScoringSchemaWithNested): WeightedCategory[] {
  return schema.categories.map((cat) => ({
    categoryId: cat.id,
    categoryWeight: toNumber(cat.weight),
    criteria: cat.criteria.map((crit) => ({
      criterionId: crit.id,
      criterionWeight: toNumber(crit.weight),
      maxScore: toNumber(crit.maxScore),
    })),
  }));
}

function validateItems(
  schema: ScoringSchemaWithNested,
  items: UpsertApplicationReviewItemDto[],
): WeightValidationError[] {
  const maxScoreByCriterionId = new Map<string, number>();
  for (const cat of schema.categories) {
    for (const crit of cat.criteria) {
      maxScoreByCriterionId.set(crit.id, toNumber(crit.maxScore));
    }
  }

  const errors: WeightValidationError[] = [];
  items.forEach((item, i) => {
    const maxScore = maxScoreByCriterionId.get(item.criterionId);
    if (maxScore === undefined) {
      errors.push({
        path: `items[${i}].criterionId`,
        message: `Criterion "${item.criterionId}" does not belong to the pinned rubric schema.`,
      });
      return;
    }
    if (item.score < 0 || item.score > maxScore) {
      errors.push({
        path: `items[${i}].score`,
        message: `Score must be between 0 and ${maxScore} for this criterion.`,
      });
    }
  });
  return errors;
}

@Injectable()
export class UpsertApplicationReviewHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    @Inject('IScoringRubricRepository')
    private readonly scoringRubricRepo: IScoringRubricRepository,
    private readonly getApplicationReviewHandler: GetApplicationReviewHandler,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpsertApplicationReviewCommand): Promise<ApplicationReviewResponseDto> {
    const application = await this.applicationRepository.findById(command.applicationId);
    if (!application) {
      throw new NotFoundException(`Application ${command.applicationId} not found`);
    }

    const existingReview = await this.prisma.applicationReview.findUnique({
      where: { applicationId_stage: { applicationId: command.applicationId, stage: command.stage } },
    });

    // A review pins the schema active at creation time and never silently migrates —
    // resolve the schema to validate/score against from the existing pin, falling back
    // to whatever is active only when this is the very first submission for this stage.
    let pinnedSchemaId = existingReview?.schemaId;
    if (!pinnedSchemaId) {
      const activeRubric = await this.scoringRubricRepo.findActiveRubric(application.programId, command.stage);
      if (!activeRubric) {
        throw new ConflictException(
          `No active "${command.stage}" scoring rubric exists for this program yet. Ask a SuperAdmin to author one on the Rubric page before scoring.`,
        );
      }
      pinnedSchemaId = activeRubric.id;
    }

    const pinnedSchema = (await this.prisma.scoringSchema.findUnique({
      where: { id: pinnedSchemaId },
      include: SCHEMA_CATEGORIES_INCLUDE,
    })) as ScoringSchemaWithNested | null;
    if (!pinnedSchema) {
      throw new NotFoundException(`Pinned scoring schema ${pinnedSchemaId} not found`);
    }

    const itemErrors = validateItems(pinnedSchema, command.payload.items);
    if (itemErrors.length > 0) {
      throw new BadRequestException({ message: 'Review items are invalid.', errors: itemErrors });
    }

    const totalScore = calculateWeightedTotal(
      toWeightedCategories(pinnedSchema),
      command.payload.items.map((item) => ({ criterionId: item.criterionId, score: item.score })),
    );
    if (totalScore > MAX_DECIMAL_5_2 || totalScore < 0) {
      throw new BadRequestException({
        message: 'Weighted total is out of range.',
        errors: [{ path: 'items', message: `Computed total ${totalScore} is outside 0-${MAX_DECIMAL_5_2}.` }],
      });
    }

    let usedOverride = false;
    if (command.stage === ScoringStage.interview) {
      const gate = await this.resolveInterviewGate(application.programId, command.applicationId);
      if (!gate.isOpen) {
        const hasOverrideReason = Boolean(command.payload.overrideReason?.trim());
        if (command.actingAdminRole !== UserRole.SUPER_ADMIN || !hasOverrideReason) {
          throw new ConflictException(
            `Interview scoring is gated: ${gate.reason}. A SUPER_ADMIN may override with a reason.`,
          );
        }
        usedOverride = true;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const review = await tx.applicationReview.upsert({
        where: { applicationId_stage: { applicationId: command.applicationId, stage: command.stage } },
        create: {
          applicationId: command.applicationId,
          schemaId: pinnedSchema.id,
          reviewerId: command.actingAdminId,
          stage: command.stage,
          totalScore,
          notes: command.payload.notes ?? null,
          status: command.payload.status,
          overrideById: usedOverride ? command.actingAdminId : null,
          overrideReason: usedOverride ? command.payload.overrideReason ?? null : null,
          completedAt: command.payload.status === 'submitted' ? new Date() : null,
        },
        update: {
          totalScore,
          notes: command.payload.notes ?? null,
          status: command.payload.status,
          overrideById: usedOverride ? command.actingAdminId : null,
          overrideReason: usedOverride ? command.payload.overrideReason ?? null : null,
          completedAt: command.payload.status === 'submitted' ? new Date() : null,
        },
      });

      // Idempotent replace: delete-then-recreate keeps re-submitting the same payload
      // a no-op in effect, and sidesteps needing per-item upserts keyed on (reviewId, criterionId).
      await tx.applicationScoreItem.deleteMany({ where: { reviewId: review.id } });
      await tx.applicationScoreItem.createMany({
        data: command.payload.items.map((item) => ({
          reviewId: review.id,
          criterionId: item.criterionId,
          score: item.score,
          notes: item.notes ?? null,
        })),
      });

      if (command.payload.status === 'submitted') {
        const outcome = resolveStageOutcome(command.stage, totalScore, toNumber(pinnedSchema.passThreshold));
        await tx.participantApplication.update({
          where: { id: command.applicationId },
          data: { scoreTotal: totalScore, scoreStatus: outcome as ScoreStatus },
        });
      }
    });

    return this.getApplicationReviewHandler.execute(
      new GetApplicationReviewQuery(command.applicationId, command.stage),
    );
  }

  private async resolveInterviewGate(programId: string, applicationId: string) {
    const [applicationStageReview, applicationRubric] = await Promise.all([
      this.prisma.applicationReview.findUnique({
        where: { applicationId_stage: { applicationId, stage: ScoringStage.application } },
      }),
      this.scoringRubricRepo.findActiveRubric(programId, ScoringStage.application),
    ]);

    const threshold = applicationRubric ? toNumber(applicationRubric.passThreshold) : 75;

    return evaluateInterviewGate(
      applicationStageReview
        ? { status: applicationStageReview.status, totalScore: toNumber(applicationStageReview.totalScore) }
        : null,
      threshold,
    );
  }
}
