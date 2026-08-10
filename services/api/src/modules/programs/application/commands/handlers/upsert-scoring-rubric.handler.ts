// services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.ts
import { Injectable, Inject, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
  UpsertRubricPayload,
} from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { UpsertScoringRubricCommand } from '../upsert-scoring-rubric.command';
import { RubricDto, RubricCategoryDto, RubricCriterionDto } from '../../../presentation/dto/scoring-rubric.dto';
import { validateWeightSums, WeightedCategory } from '../../../../scoring/domain/scoring-calculation';

// The fields covered by @@unique([programId, stage, version]) on ScoringSchema.
// Only a P2002 that targets this exact constraint is a version race; any other
// P2002 (e.g. a future unrelated unique column) must not be treated as one.
const VERSION_UNIQUE_CONSTRAINT_FIELDS = ['programId', 'stage', 'version'];

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
    version: schema.version,
    passThreshold: toNumber(schema.passThreshold),
    categories,
  };
}

function validateRowShapes(payload: UpsertRubricPayload): void {
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

function toWeightedCategories(payload: UpsertRubricPayload): WeightedCategory[] {
  return payload.categories.map((cat, i) => ({
    categoryId: `categories[${i}]`,
    categoryWeight: cat.weight,
    criteria: cat.criteria.map((crit) => ({
      criterionId: crit.name,
      criterionWeight: crit.weight,
      maxScore: crit.maxScore,
    })),
  }));
}

/**
 * True when `error` is the P2002 raised by ScoringSchema's
 * @@unique([programId, stage, version]) constraint specifically -- i.e. two
 * concurrent mints for the same (programId, stage) both computed the same
 * MAX(version)+1 and lost the race to insert first. Any other P2002 (a
 * different constraint entirely) is not a version race and must propagate.
 */
function isVersionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (!Array.isArray(target)) return false;
  return VERSION_UNIQUE_CONSTRAINT_FIELDS.every((field) => target.includes(field));
}

@Injectable()
export class UpsertScoringRubricHandler {
  constructor(
    @Inject('IScoringRubricRepository')
    private readonly repo: IScoringRubricRepository,
  ) {}

  async execute(command: UpsertScoringRubricCommand): Promise<RubricDto> {
    validateRowShapes(command.payload);

    const weightErrors = validateWeightSums(toWeightedCategories(command.payload));
    if (weightErrors.length > 0) {
      throw new BadRequestException({
        message: 'Rubric weights are invalid.',
        errors: weightErrors,
      });
    }

    // Two admins saving the same (programId, stage) at nearly the same instant
    // can both compute the same next version number (see
    // scoring-rubric.repository.ts mintRubricVersion) and one insert loses to
    // the unique constraint. That is a genuine, if rare, race under normal
    // concurrent editing (not an attack, not corrupt data) -- retrying once
    // re-reads MAX(version) fresh and almost always succeeds without bothering
    // the admin. Only if it collides twice in a row (heavy contention) do we
    // give up and tell them explicitly, rather than let a second P2002 or any
    // other unexpected error surface as an unhandled 500.
    try {
      const result = await this.repo.mintRubricVersion(
        command.programId,
        command.stage,
        command.payload,
        command.createdById,
      );
      return mapToRubricDto(result);
    } catch (error) {
      if (!isVersionConflict(error)) throw error;

      try {
        const retried = await this.repo.mintRubricVersion(
          command.programId,
          command.stage,
          command.payload,
          command.createdById,
        );
        return mapToRubricDto(retried);
      } catch (retryError) {
        if (isVersionConflict(retryError)) {
          throw new ConflictException({
            code: 'rubric_version_conflict',
            message: 'Someone else just saved a new version of this rubric. Reload and try again.',
          });
        }
        throw retryError;
      }
    }
  }
}
