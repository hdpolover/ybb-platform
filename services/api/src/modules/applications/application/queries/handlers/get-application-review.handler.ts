// services/api/src/modules/applications/application/queries/handlers/get-application-review.handler.ts
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
} from '@core/interfaces/repositories/scoring-rubric.repository.interface';
import { mapSchema } from '@modules/programs/application/queries/handlers/get-scoring-rubrics.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { evaluateInterviewGate, GateState } from '@modules/scoring/domain/scoring-calculation';
import { GetApplicationReviewQuery } from '../get-application-review.query';
import {
  ApplicationReviewResponseDto,
  ApplicationScoreItemDto,
} from '../../dto/application-review-response.dto';

function toNumber(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

const SCHEMA_CATEGORIES_INCLUDE = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: { criteria: { orderBy: { order: 'asc' as const } } },
  },
};

@Injectable()
export class GetApplicationReviewHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    @Inject('IScoringRubricRepository')
    private readonly scoringRubricRepo: IScoringRubricRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetApplicationReviewQuery): Promise<ApplicationReviewResponseDto> {
    const application = await this.applicationRepository.findById(query.applicationId);
    if (!application) {
      throw new NotFoundException(`Application ${query.applicationId} not found`);
    }

    // programId is always derived from the looked-up application, never
    // from client input, so this handler cannot be tricked into reading
    // another program's rubric or review.
    const activeRubric = await this.scoringRubricRepo.findActiveRubric(application.programId, query.stage);
    if (!activeRubric) {
      throw new ConflictException(
        `No active "${query.stage}" scoring rubric exists for this program yet. Ask a SuperAdmin to author one on the Rubric page before scoring.`,
      );
    }

    const gate = await this.resolveGate(application.programId, application.id, query.stage);

    const existingReview = await this.prisma.applicationReview.findUnique({
      where: { applicationId_stage: { applicationId: query.applicationId, stage: query.stage } },
      include: { items: true },
    });

    if (!existingReview) {
      return {
        id: null,
        applicationId: query.applicationId,
        stage: query.stage,
        schemaId: activeRubric.id,
        schemaVersion: activeRubric.version,
        status: 'draft',
        totalScore: 0,
        notes: null,
        items: [],
        rubric: mapSchema(activeRubric),
        gate,
        hasNewerRubricVersion: false,
      };
    }

    const pinnedSchema = (await this.prisma.scoringSchema.findUnique({
      where: { id: existingReview.schemaId },
      include: SCHEMA_CATEGORIES_INCLUDE,
    })) as ScoringSchemaWithNested | null;

    if (!pinnedSchema) {
      throw new NotFoundException(`Pinned scoring schema ${existingReview.schemaId} not found`);
    }

    const items: ApplicationScoreItemDto[] = existingReview.items.map((item) => ({
      criterionId: item.criterionId,
      score: toNumber(item.score),
      notes: item.notes,
    }));

    return {
      id: existingReview.id,
      applicationId: query.applicationId,
      stage: query.stage,
      schemaId: pinnedSchema.id,
      schemaVersion: pinnedSchema.version,
      status: existingReview.status,
      totalScore: toNumber(existingReview.totalScore),
      notes: existingReview.notes,
      items,
      rubric: mapSchema(pinnedSchema),
      gate,
      hasNewerRubricVersion: pinnedSchema.version < activeRubric.version,
    };
  }

  /** The application stage has nothing gating it. Only the interview stage checks the application stage's outcome. */
  private async resolveGate(
    programId: string,
    applicationId: string,
    stage: ScoringStage,
  ): Promise<GateState> {
    if (stage === ScoringStage.application) {
      return { isOpen: true, reason: 'open', applicationTotal: null, applicationThreshold: null };
    }

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
