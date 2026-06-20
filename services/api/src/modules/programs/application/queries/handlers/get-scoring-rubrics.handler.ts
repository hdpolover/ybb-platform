import { Injectable, Inject } from '@nestjs/common';
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

function toNumber(value: Prisma.Decimal | number): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

function mapSchema(schema: ScoringSchemaWithNested): RubricDto {
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
    const isUuid = UUID_REGEX.test(query.programId);
    let programId = query.programId;

    if (!isUuid) {
      const found = await this.programRepo.findBySlug(query.programId);
      programId = found?.id ?? query.programId;
    }

    const schemas = await this.repo.findRubricsByProgramId(programId, query.stage);

    const application = schemas.find((s) => s.stage === ScoringStage.application);
    const interview = schemas.find((s) => s.stage === ScoringStage.interview);

    return {
      application: application ? mapSchema(application) : null,
      interview: interview ? mapSchema(interview) : null,
    };
  }
}
