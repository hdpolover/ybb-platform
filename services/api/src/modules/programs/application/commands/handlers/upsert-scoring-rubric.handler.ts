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

// The fields covered by @@unique([programId, stage, version]) on ScoringSchema,
// as ALIAS GROUPS: each entry lists every spelling that field could show up
// under, because the spelling actually observed depends on how Prisma reports
// the violation (see targetFieldsOf below) -- Prisma-field camelCase in
// meta.target on some engines/versions, DB-column snake_case parsed out of
// the message text on others. A P2002 is the version-race constraint only if
// every group has at least one alias present; any other P2002 (e.g. a future
// unrelated unique column) must not be treated as one.
const VERSION_UNIQUE_CONSTRAINT_FIELD_ALIASES: readonly (readonly string[])[] = [
  ['programId', 'program_id'],
  ['stage'],
  ['version'],
];

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
export function isVersionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  const fields = targetFieldsOf(error);
  return VERSION_UNIQUE_CONSTRAINT_FIELD_ALIASES.every((aliases) =>
    aliases.some((alias) => fields.includes(alias)),
  );
}

// Matches the parenthesized field list Prisma's query engine puts in the
// human-readable P2002 message, e.g.
//   Unique constraint failed on the fields: (`program_id`, `stage`, `version`)
const UNIQUE_CONSTRAINT_MESSAGE_RE = /Unique constraint failed on the fields: \(([^)]*)\)/;

/**
 * Extracts the constraint's field names from a P2002 error, tolerating every
 * shape observed so far -- do not assume any one of these is "the" shape:
 *
 * - meta.driverAdapterError.cause.constraint.fields as string[] of DB column
 *   names: the most precise shape observed, and what Prisma 7.3.0 with
 *   @prisma/adapter-pg actually populates against Postgres (verified in
 *   test/integration/scoring-rubric-version-conflict.spec.ts). It comes
 *   straight from Postgres's own error detail, so it is exact.
 * - meta.target as string[] of Prisma field names (documented Prisma
 *   behavior on some engines/versions, but NOT what adapter-pg + Postgres
 *   populates -- meta.target was `undefined` in the same verification run).
 * - meta.target as a single delimited string (some driver adapters).
 * - message text as a last resort, e.g.
 *   "Unique constraint failed on the fields: (`program_id`, `stage`, `version`)"
 *   -- also confirmed present in the same verification run, backtick-quoted
 *   snake_case DB columns.
 *
 * Relying on meta.target alone, as an earlier version of this function did,
 * made the retry/409 path silently dead code against a real Postgres
 * database -- every genuine version race would have degraded to an
 * unhandled 500 instead of the retry-then-409 this handler exists to
 * provide.
 */
function targetFieldsOf(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = error.meta as
    | { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } }
    | undefined;

  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) return adapterFields as string[];

  const target = meta?.target;
  if (Array.isArray(target)) return target as string[];
  if (typeof target === 'string' && target.length > 0) {
    return target.split(/[,\s]+/).filter(Boolean);
  }

  const match = UNIQUE_CONSTRAINT_MESSAGE_RE.exec(error.message);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((field) => field.trim().replace(/`/g, ''))
    .filter(Boolean);
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
