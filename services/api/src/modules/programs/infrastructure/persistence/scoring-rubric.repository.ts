import { Injectable } from '@nestjs/common';
import { ScoringStage } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
  UpsertRubricPayload,
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

@Injectable()
export class ScoringRubricRepository implements IScoringRubricRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRubricsByProgramId(
    programId: string,
    stage?: ScoringStage,
  ): Promise<ScoringSchemaWithNested[]> {
    const where: Record<string, unknown> = { programId, deletedAt: null };
    if (stage !== undefined) where.stage = stage;

    return this.prisma.scoringSchema.findMany({
      where,
      include: CATEGORIES_INCLUDE,
    }) as Promise<ScoringSchemaWithNested[]>;
  }

  async upsertRubric(
    programId: string,
    stage: ScoringStage,
    payload: UpsertRubricPayload,
  ): Promise<ScoringSchemaWithNested> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find or create the schema for this (programId, stage)
      let schema = await tx.scoringSchema.findFirst({
        where: { programId, stage, deletedAt: null },
      });

      if (!schema) {
        schema = await tx.scoringSchema.create({
          data: {
            programId,
            stage,
            name: payload.name ?? `${stage} Rubric`,
            description: payload.description ?? null,
            isActive: true,
          },
        });
      } else if (payload.name !== undefined || payload.description !== undefined) {
        schema = await tx.scoringSchema.update({
          where: { id: schema.id },
          data: {
            ...(payload.name !== undefined && { name: payload.name }),
            ...(payload.description !== undefined && { description: payload.description }),
          },
        });
      }

      const schemaId = schema.id;

      // 2. Reconcile categories: collect ids present in payload
      const payloadCategoryIds = payload.categories
        .filter((c) => c.id !== undefined)
        .map((c) => c.id as string);

      // Delete categories absent from the payload
      await tx.scoringCategory.deleteMany({
        where: {
          schemaId,
          ...(payloadCategoryIds.length > 0 ? { id: { notIn: payloadCategoryIds } } : {}),
        },
      });

      // 3. Upsert categories + their criteria
      for (const cat of payload.categories) {
        let categoryId: string;

        if (cat.id) {
          // Update existing
          await tx.scoringCategory.update({
            where: { id: cat.id },
            data: {
              name: cat.name,
              description: cat.description ?? null,
              weight: cat.weight,
              order: cat.order,
            },
          });
          categoryId = cat.id;
        } else {
          // Create new
          const created = await tx.scoringCategory.create({
            data: {
              schemaId,
              name: cat.name,
              description: cat.description ?? null,
              weight: cat.weight,
              order: cat.order,
            },
          });
          categoryId = created.id;
        }

        // Reconcile criteria within this category
        const payloadCriterionIds = cat.criteria
          .filter((c) => c.id !== undefined)
          .map((c) => c.id as string);

        await tx.scoringCriterion.deleteMany({
          where: {
            categoryId,
            ...(payloadCriterionIds.length > 0 ? { id: { notIn: payloadCriterionIds } } : {}),
          },
        });

        for (const crit of cat.criteria) {
          if (crit.id) {
            await tx.scoringCriterion.update({
              where: { id: crit.id },
              data: {
                name: crit.name,
                description: crit.description ?? null,
                weight: crit.weight,
                maxScore: crit.maxScore,
                order: crit.order,
              },
            });
          } else {
            await tx.scoringCriterion.create({
              data: {
                categoryId,
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

      // 4. Re-fetch the full schema with nested data
      const rows = await tx.scoringSchema.findMany({
        where: { id: schemaId },
        include: {
          categories: {
            orderBy: { order: 'asc' },
            include: {
              criteria: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      const result = rows[0];
      if (!result) throw new Error(`ScoringSchema ${schemaId} disappeared mid-transaction`);
      return result as ScoringSchemaWithNested;
    });
  }
}
