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
import {
  UpsertApplicationReviewCommand,
  UpsertApplicationReviewDto,
  UpsertApplicationReviewItemDto,
} from '../upsert-application-review.command';

// Decimal(5,2) columns (total_score, pass_threshold) top out at 999.99. A rubric with valid
// weights (each level sums to 1.0) can still overflow this if an admin sets an oversized
// maxScore on a criterion. Reject before Postgres ever sees it, per the VarChar/Decimal
// overflow defect class already hit three times in this codebase.
const MAX_DECIMAL_5_2 = 999.99;

const SCHEMA_CATEGORIES_INCLUDE = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: { criteria: { orderBy: { order: 'asc' as const } } },
  },
};

// Structural type covering both PrismaService and the $transaction callback's tx client,
// since loadSchema needs to run inside and outside the transaction with the same shape.
type SchemaReader = {
  scoringSchema: {
    findUnique(args: {
      where: { id: string };
      include: typeof SCHEMA_CATEGORIES_INCLUDE;
    }): Promise<unknown>;
  };
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

// Validates each item against the pinned schema: membership, finiteness, range, and no
// duplicate criterionId. When submitting, also requires every criterion in the schema to
// be covered exactly once. calculateWeightedTotal silently treats an absent criterion as a
// score of 0, so without this completeness check an incomplete submit can wrongly reject a
// real applicant with no error ever surfacing. Drafts are exempt: partial drafts are the
// entire point of drafts.
function validateItems(
  schema: ScoringSchemaWithNested,
  items: UpsertApplicationReviewItemDto[],
  status: 'draft' | 'submitted',
): WeightValidationError[] {
  const maxScoreByCriterionId = new Map<string, number>();
  for (const cat of schema.categories) {
    for (const crit of cat.criteria) {
      maxScoreByCriterionId.set(crit.id, toNumber(crit.maxScore));
    }
  }

  const errors: WeightValidationError[] = [];
  const seenCriterionIds = new Set<string>();

  items.forEach((item, i) => {
    if (typeof item.score !== 'number' || !Number.isFinite(item.score)) {
      errors.push({ path: `items[${i}].score`, message: 'Score must be a finite number.' });
      return;
    }

    const maxScore = maxScoreByCriterionId.get(item.criterionId);
    if (maxScore === undefined) {
      errors.push({
        path: `items[${i}].criterionId`,
        message: `Criterion "${item.criterionId}" does not belong to the pinned rubric schema.`,
      });
      return;
    }

    if (seenCriterionIds.has(item.criterionId)) {
      // ApplicationScoreItem has @@unique([reviewId, criterionId]); letting a duplicate
      // through would pass this check and then blow up createMany with a raw Prisma P2002.
      // This Prisma 7 + @prisma/adapter-pg combination leaves error.meta.target undefined,
      // so there is no reliable way to turn that into a clean 400 after the fact. Reject here.
      errors.push({
        path: `items[${i}].criterionId`,
        message: `Criterion "${item.criterionId}" is scored more than once in this submission.`,
      });
      return;
    }
    seenCriterionIds.add(item.criterionId);

    if (item.score < 0 || item.score > maxScore) {
      errors.push({
        path: `items[${i}].score`,
        message: `Score must be between 0 and ${maxScore} for this criterion.`,
      });
    }
  });

  if (status === 'submitted') {
    for (const criterionId of maxScoreByCriterionId.keys()) {
      if (!seenCriterionIds.has(criterionId)) {
        errors.push({
          path: 'items',
          message: `Missing score for required criterion "${criterionId}".`,
        });
      }
    }
  }

  return errors;
}

function validateAndScore(schema: ScoringSchemaWithNested, payload: UpsertApplicationReviewDto): number {
  const itemErrors = validateItems(schema, payload.items, payload.status);
  if (itemErrors.length > 0) {
    throw new BadRequestException({ message: 'Review items are invalid.', errors: itemErrors });
  }

  const totalScore = calculateWeightedTotal(
    toWeightedCategories(schema),
    payload.items.map((item) => ({ criterionId: item.criterionId, score: item.score })),
  );

  if (!Number.isFinite(totalScore) || totalScore > MAX_DECIMAL_5_2 || totalScore < 0) {
    throw new BadRequestException({
      message: 'Weighted total is out of range.',
      errors: [{ path: 'items', message: `Computed total ${totalScore} is outside 0-${MAX_DECIMAL_5_2}.` }],
    });
  }

  return totalScore;
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

    // A review pins the schema active at creation time and never silently migrates.
    // Resolve the schema to validate/score against from the existing pin, falling back
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

    const pinnedSchema = await this.loadSchema(this.prisma, pinnedSchemaId);
    if (!pinnedSchema) {
      throw new NotFoundException(`Pinned scoring schema ${pinnedSchemaId} not found`);
    }

    const totalScore = validateAndScore(pinnedSchema, command.payload);

    // The gate only blocks *submitting* an interview score. An admin can still draft
    // interview notes/scores before the application stage clears; they just cannot
    // finalize them until the gate opens (or a SUPER_ADMIN overrides it).
    let usedOverride = false;
    if (command.stage === ScoringStage.interview && command.payload.status === 'submitted') {
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
          // Attribution: every write (draft or submitted) stamps the acting admin as the
          // reviewer, so the review always reflects who last touched it. Previously this
          // branch omitted reviewerId entirely, so a review created by Admin A stayed
          // permanently attributed to A even after Admin B submitted it.
          reviewerId: command.actingAdminId,
          // Override audit: only ever SET overrideById/overrideReason when this write
          // actually used an override. A normal (non-override) draft save must never null
          // out a previously recorded override -- omitting these keys entirely leaves
          // Prisma's update untouched, preserving whatever was recorded before.
          ...(usedOverride
            ? { overrideById: command.actingAdminId, overrideReason: command.payload.overrideReason ?? null }
            : {}),
          completedAt: command.payload.status === 'submitted' ? new Date() : null,
        },
      });

      // Schema-pin race guard. existingReview and findActiveRubric above both read outside
      // this transaction, so two concurrent first submissions can each resolve a different
      // active rubric. Postgres's atomic upsert lets only one of them win the create branch;
      // the loser's update branch never rewrites schemaId, so its totalScore may have been
      // computed against a schema that is not the one actually persisted. Reload the row
      // this call actually wrote and, if its schemaId disagrees with what we scored against,
      // rescore against the schema that is provably the one stored before writing anything else.
      let finalSchema = pinnedSchema;
      let finalTotal = totalScore;
      if (review.schemaId !== pinnedSchema.id) {
        const actualSchema = await this.loadSchema(tx, review.schemaId);
        if (!actualSchema) {
          throw new NotFoundException(`Pinned scoring schema ${review.schemaId} not found`);
        }
        finalTotal = validateAndScore(actualSchema, command.payload);
        finalSchema = actualSchema;
        await tx.applicationReview.update({ where: { id: review.id }, data: { totalScore: finalTotal } });
      }

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
        const outcome = resolveStageOutcome(command.stage, finalTotal, toNumber(finalSchema.passThreshold));
        await tx.participantApplication.update({
          where: { id: command.applicationId },
          data: { scoreTotal: finalTotal, scoreStatus: outcome as ScoreStatus },
        });
      }
    });

    return this.getApplicationReviewHandler.execute(
      new GetApplicationReviewQuery(command.applicationId, command.stage),
    );
  }

  private async loadSchema(client: SchemaReader, schemaId: string): Promise<ScoringSchemaWithNested | null> {
    return client.scoringSchema.findUnique({
      where: { id: schemaId },
      include: SCHEMA_CATEGORIES_INCLUDE,
    }) as Promise<ScoringSchemaWithNested | null>;
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
