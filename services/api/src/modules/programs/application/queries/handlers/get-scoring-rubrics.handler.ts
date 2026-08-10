// services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { IScoringRubricRepository, ScoringSchemaWithNested } from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { IProgramRepository } from '../../../../../core/interfaces/repositories/program.repository.interface';
import { GetScoringRubricsQuery } from '../get-scoring-rubrics.query';
import {
  ScoringRubricsResponseDto,
  RubricDto,
  RubricCategoryDto,
  RubricCriterionDto,
} from '../../../presentation/dto/scoring-rubric.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolves an admin route param that may be a program slug or a UUID into the program's UUID. */
export async function resolveProgramId(
  programRepo: IProgramRepository,
  programIdOrSlug: string,
): Promise<string> {
  if (UUID_REGEX.test(programIdOrSlug)) return programIdOrSlug;
  const found = await programRepo.findBySlug(programIdOrSlug);
  return found?.id ?? programIdOrSlug;
}

function toNumber(value: Prisma.Decimal | number): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

export function mapSchema(schema: ScoringSchemaWithNested): RubricDto {
  const categories: RubricCategoryDto[] = schema.categories.map((cat) => {
    const criteria: RubricCriterionDto[] = cat.criteria.map((crit) => ({
      id: crit.id,
      name: crit.name,
      description: crit.description,
      weight: toNumber(crit.weight),
      maxScore: toNumber(crit.maxScore),
      order: crit.order,
    }));
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      weight: toNumber(cat.weight),
      order: cat.order,
      criteria,
    };
  });
  return {
    id: schema.id,
    programId: schema.programId,
    stage: schema.stage,
    name: schema.name,
    description: schema.description,
    isActive: schema.isActive,
    version: schema.version,
    passThreshold: toNumber(schema.passThreshold),
    categories,
  };
}

@Injectable()
export class GetScoringRubricsHandler {
  constructor(
    @Inject('IScoringRubricRepository')
    private readonly repo: IScoringRubricRepository,
    @Inject('IProgramRepository')
    private readonly programRepo: IProgramRepository,
  ) {}

  async execute(query: GetScoringRubricsQuery): Promise<ScoringRubricsResponseDto> {
    const programId = await resolveProgramId(this.programRepo, query.programId);

    // A specific version only ever applies to a single, explicitly requested stage.
    if (query.stage && query.version !== undefined) {
      const schema = await this.repo.findRubricVersion(programId, query.stage, query.version);
      if (!schema) {
        throw new NotFoundException(
          `No rubric version ${query.version} found for stage "${query.stage}".`,
        );
      }
      const dto = mapSchema(schema);
      return {
        application: query.stage === ScoringStage.application ? dto : null,
        interview: query.stage === ScoringStage.interview ? dto : null,
      };
    }

    if (query.stage) {
      const schema = await this.repo.findActiveRubric(programId, query.stage);
      const dto = schema ? mapSchema(schema) : null;
      return {
        application: query.stage === ScoringStage.application ? dto : null,
        interview: query.stage === ScoringStage.interview ? dto : null,
      };
    }

    const [application, interview] = await Promise.all([
      this.repo.findActiveRubric(programId, ScoringStage.application),
      this.repo.findActiveRubric(programId, ScoringStage.interview),
    ]);

    return {
      application: application ? mapSchema(application) : null,
      interview: interview ? mapSchema(interview) : null,
    };
  }
}
