// services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
  UpsertRubricPayload,
  UpsertCategoryPayload,
} from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

const CATEGORIES_INCLUDE = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: {
      criteria: {
        orderBy: { order: 'asc' as const },
      },
    },
  },
};

function toNumber(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

/**
 * True when `payload` describes the exact same rubric shape as `active`:
 * same category count/order/name/description/weight, same criteria
 * count/order/name/description/weight/maxScore within each category.
 * Row ids are intentionally ignored -- new payloads never carry them,
 * since categories/criteria are only ever created fresh per version.
 */
function isSemanticallyIdentical(
  active: ScoringSchemaWithNested,
  payload: UpsertRubricPayload,
): boolean {
  if ((payload.name ?? active.name) !== active.name) return false;
  if ((payload.description ?? null) !== (active.description ?? null)) return false;
  if ((payload.passThreshold ?? toNumber(active.passThreshold)) !== toNumber(active.passThreshold)) {
    return false;
  }
  if (payload.categories.length !== active.categories.length) return false;

  const sortedActive = [...active.categories].sort((a, b) => a.order - b.order);
  const sortedPayload = [...payload.categories].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sortedActive.length; i++) {
    const a = sortedActive[i];
    const p = sortedPayload[i];
    if (a.name !== p.name) return false;
    if ((a.description ?? null) !== (p.description ?? null)) return false;
    if (toNumber(a.weight) !== p.weight) return false;
    if (a.order !== p.order) return false;
    if (a.criteria.length !== p.criteria.length) return false;

    const sortedActiveCriteria = [...a.criteria].sort((x, y) => x.order - y.order);
    const sortedPayloadCriteria = [...p.criteria].sort((x, y) => x.order - y.order);

    for (let j = 0; j < sortedActiveCriteria.length; j++) {
      const ac = sortedActiveCriteria[j];
      const pc = sortedPayloadCriteria[j];
      if (ac.name !== pc.name) return false;
      if ((ac.description ?? null) !== (pc.description ?? null)) return false;
      if (toNumber(ac.weight) !== pc.weight) return false;
      if (toNumber(ac.maxScore) !== pc.maxScore) return false;
      if (ac.order !== pc.order) return false;
    }
  }

  return true;
}

@Injectable()
export class ScoringRubricRepository implements IScoringRubricRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveRubric(
    programId: string,
    stage: ScoringStage,
  ): Promise<ScoringSchemaWithNested | null> {
    return this.prisma.scoringSchema.findFirst({
      where: { programId, stage, isActive: true, deletedAt: null },
      include: CATEGORIES_INCLUDE,
    }) as Promise<ScoringSchemaWithNested | null>;
  }

  async findRubricVersion(
    programId: string,
    stage: ScoringStage,
    version: number,
  ): Promise<ScoringSchemaWithNested | null> {
    return this.prisma.scoringSchema.findFirst({
      where: { programId, stage, version, deletedAt: null },
      include: CATEGORIES_INCLUDE,
    }) as Promise<ScoringSchemaWithNested | null>;
  }

  async findRubricHistory(
    programId: string,
    stage: ScoringStage,
  ): Promise<ScoringSchemaWithNested[]> {
    return this.prisma.scoringSchema.findMany({
      where: { programId, stage, deletedAt: null },
      orderBy: { version: 'desc' },
      include: CATEGORIES_INCLUDE,
    }) as Promise<ScoringSchemaWithNested[]>;
  }

  async mintRubricVersion(
    programId: string,
    stage: ScoringStage,
    payload: UpsertRubricPayload,
    createdById: string | null,
  ): Promise<ScoringSchemaWithNested> {
    return this.prisma.$transaction(async (tx) => {
      const active = (await tx.scoringSchema.findFirst({
        where: { programId, stage, isActive: true, deletedAt: null },
        include: CATEGORIES_INCLUDE,
      })) as ScoringSchemaWithNested | null;

      if (active && isSemanticallyIdentical(active, payload)) {
        return active;
      }

      // MAX(version) across ALL rows for this (programId, stage), including
      // soft-deleted ones. @@unique([programId, stage, version]) has no
      // deletedAt filter, so a soft-deleted row still reserves its version
      // number forever; deriving the next version from active-row count (or
      // from active.version alone, when there is no active row) would
      // collide with a version a deleted row already occupies.
      const versionAggregate = await tx.scoringSchema.aggregate({
        where: { programId, stage },
        _max: { version: true },
      });
      const nextVersion = (versionAggregate._max.version ?? 0) + 1;

      // Deactivate the previous active row BEFORE inserting the new one.
      // scoring_schemas_one_active_per_program_stage_uidx is a partial
      // unique index on (program_id, stage) WHERE is_active AND deleted_at
      // IS NULL -- inserting the new active row first would collide with
      // the still-active old row and be rejected by that index.
      if (active) {
        await tx.scoringSchema.update({
          where: { id: active.id },
          data: { isActive: false },
        });
      }

      const created = await tx.scoringSchema.create({
        data: {
          programId,
          stage,
          name: payload.name ?? active?.name ?? `${stage} Rubric`,
          description: payload.description ?? active?.description ?? null,
          isActive: true,
          version: nextVersion,
          createdById,
          passThreshold: payload.passThreshold ?? (active ? toNumber(active.passThreshold) : 75),
        },
      });

      for (const cat of payload.categories) {
        await this.createCategoryWithCriteria(tx, created.id, cat);
      }

      const rows = await tx.scoringSchema.findMany({
        where: { id: created.id },
        include: CATEGORIES_INCLUDE,
      });

      const result = rows[0];
      if (!result) throw new Error(`ScoringSchema ${created.id} disappeared mid-transaction`);
      return result as ScoringSchemaWithNested;
    });
  }

  private async createCategoryWithCriteria(
    tx: Prisma.TransactionClient,
    schemaId: string,
    cat: UpsertCategoryPayload,
  ): Promise<void> {
    const createdCategory = await tx.scoringCategory.create({
      data: {
        schemaId,
        name: cat.name,
        description: cat.description ?? null,
        weight: cat.weight,
        order: cat.order,
      },
    });

    for (const crit of cat.criteria) {
      await tx.scoringCriterion.create({
        data: {
          categoryId: createdCategory.id,
          name: crit.name,
          description: crit.description ?? null,
          weight: crit.weight,
          maxScore: crit.maxScore,
          order: crit.order,
        },
      });
    }
  }
}
