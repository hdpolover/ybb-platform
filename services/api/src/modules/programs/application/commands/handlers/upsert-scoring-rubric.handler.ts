import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
  UpsertRubricPayload,
} from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { UpsertScoringRubricCommand } from '../upsert-scoring-rubric.command';
import { RubricDto, RubricCategoryDto, RubricCriterionDto } from '../../../presentation/dto/scoring-rubric.dto';

function toNumber(value: Prisma.Decimal | number): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

function mapToRubricDto(schema: ScoringSchemaWithNested): RubricDto {
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

function validatePayload(payload: UpsertRubricPayload): void {
  for (const cat of payload.categories) {
    if (!cat.name || cat.name.trim().length === 0) {
      throw new BadRequestException('Category name must not be empty');
    }
    if (cat.weight < 0) {
      throw new BadRequestException(`Category "${cat.name}" weight must be >= 0`);
    }
    for (const crit of cat.criteria) {
      if (!crit.name || crit.name.trim().length === 0) {
        throw new BadRequestException('Criterion name must not be empty');
      }
      if (crit.weight < 0) {
        throw new BadRequestException(`Criterion "${crit.name}" weight must be >= 0`);
      }
      if (crit.maxScore <= 0) {
        throw new BadRequestException(`Criterion "${crit.name}" maxScore must be > 0`);
      }
    }
  }
}

@Injectable()
export class UpsertScoringRubricHandler {
  constructor(
    @Inject('IScoringRubricRepository')
    private readonly repo: IScoringRubricRepository,
  ) {}

  async execute(command: UpsertScoringRubricCommand): Promise<RubricDto> {
    validatePayload(command.payload);
    const result = await this.repo.upsertRubric(
      command.programId,
      command.stage,
      command.payload,
    );
    return mapToRubricDto(result);
  }
}
