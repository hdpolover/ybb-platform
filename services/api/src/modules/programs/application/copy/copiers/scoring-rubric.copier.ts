// services/api/src/modules/programs/application/copy/copiers/scoring-rubric.copier.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { parseTemplateItems } from '../template-payload.schemas';
import { ScoringSchemaWithNested, UpsertRubricPayload } from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { CATEGORIES_INCLUDE, mintRubricVersionInTx, toNumber } from '../../../infrastructure/persistence/scoring-rubric.repository';
import { validateWeightSums } from '../../../../scoring/domain/scoring-calculation';

type TemplateCriterion = { name: string; description: string | null; weight: number; maxScore: number; order: number };
type TemplateCategory = { name: string; description: string | null; weight: number; order: number; criteria: TemplateCriterion[] };
type TemplateItem = {
  stage: ScoringStage;
  name: string;
  description: string | null;
  passThreshold: number;
  categories: TemplateCategory[];
};

const STAGE_LABELS: Record<ScoringStage, string> = {
  application: 'Application rubric',
  interview: 'Interview rubric',
};

const ACTIVE_WHERE = { isActive: true, deletedAt: null } as const;

function toTemplateItem(row: ScoringSchemaWithNested): TemplateItem {
  return {
    stage: row.stage,
    name: row.name,
    description: row.description,
    passThreshold: toNumber(row.passThreshold),
    categories: row.categories.map((cat) => ({
      name: cat.name,
      description: cat.description,
      weight: toNumber(cat.weight),
      order: cat.order,
      criteria: cat.criteria.map((crit) => ({
        name: crit.name,
        description: crit.description,
        weight: toNumber(crit.weight),
        maxScore: toNumber(crit.maxScore),
        order: crit.order,
      })),
    })),
  };
}

function toMintPayload(item: TemplateItem): UpsertRubricPayload {
  return {
    name: item.name,
    // null, not undefined: a copy is exact, so a source without a description
    // must clear the target's rather than inherit it (which would also make
    // every repeat copy look different and mint a fresh version).
    description: item.description,
    passThreshold: item.passThreshold,
    categories: item.categories.map((cat) => ({
      name: cat.name,
      description: cat.description ?? undefined,
      weight: cat.weight,
      order: cat.order,
      criteria: cat.criteria.map((crit) => ({
        name: crit.name,
        description: crit.description ?? undefined,
        weight: crit.weight,
        maxScore: crit.maxScore,
        order: crit.order,
      })),
    })),
  };
}

function assertValidWeights(items: TemplateItem[]): void {
  const stages = new Set<string>();
  for (const item of items) {
    if (stages.has(item.stage)) {
      throw new BadRequestException({
        code: 'duplicate_rubric_stage',
        message: `The template carries more than one '${item.stage}' rubric.`,
      });
    }
    stages.add(item.stage);

    const errors = validateWeightSums(
      item.categories.map((cat, i) => ({
        categoryId: `categories[${i}]`,
        categoryWeight: cat.weight,
        criteria: cat.criteria.map((crit) => ({ criterionId: crit.name, criterionWeight: crit.weight, maxScore: crit.maxScore })),
      })),
    );
    if (errors.length > 0) {
      throw new BadRequestException({
        code: 'invalid_rubric_weights',
        message: `The '${item.stage}' rubric weights are invalid.`,
        errors,
      });
    }
  }
}

/**
 * An "item" is one stage's ACTIVE rubric (0..2 per program). Nothing is ever
 * deleted: replace mints a new version on the target, which deactivates the
 * previous one, so reviews already pinned to an old version keep their rubric.
 * Minting runs on the caller's tx (mintRubricVersionInTx), not a nested
 * $transaction.
 */
@Injectable()
export class ScoringRubricCopier implements ProgramCopier {
  readonly key = 'scoring-rubric';
  readonly label = 'Scoring Rubric';
  readonly supportsAppend = true;
  // Mirrors @RequiresProgramPermission on PUT :programId/scoring-rubrics/:stage.
  readonly requiredPermissions = ['program:write'] as const;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.scoringSchema.count({ where: { programId, ...ACTIVE_WHERE } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const rows = await this.loadActive(this.prisma, programId);
    return rows.map((row) => {
      const criteriaCount = row.categories.reduce((n, cat) => n + cat.criteria.length, 0);
      return {
        id: row.id,
        label: STAGE_LABELS[row.stage],
        meta: `${row.categories.length} categories, ${criteriaCount} criteria, pass ${toNumber(row.passThreshold)}`,
      };
    });
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const rows = await this.loadActive(tx, input.sourceProgramId, input.itemIds);
    return this.applyItems(tx, rows.map(toTemplateItem), input.targetProgramId, input.mode);
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    const rows = await this.loadActive(this.prisma, programId, itemIds);
    return { entityType: this.key, payloadVersion: 1, items: rows.map(toTemplateItem) as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    assertValidWeights(items);
    return this.applyItems(tx, items, targetProgramId, mode);
  }

  private async loadActive(client: PrismaService, programId: string, itemIds?: string[]): Promise<ScoringSchemaWithNested[]> {
    const rows = (await client.scoringSchema.findMany({
      where: { programId, ...ACTIVE_WHERE },
      orderBy: { stage: 'asc' },
      include: CATEGORIES_INCLUDE,
    })) as ScoringSchemaWithNested[];
    if (!itemIds || itemIds.length === 0) return rows;
    const idSet = new Set(itemIds);
    return rows.filter((row) => idSet.has(row.id));
  }

  private async applyItems(tx: PrismaTx, items: TemplateItem[], targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const result: CopyResult = { created: 0, skipped: 0, replaced: 0 };
    const client = tx as unknown as Prisma.TransactionClient;

    for (const item of items) {
      const existing = await client.scoringSchema.findFirst({ where: { programId: targetProgramId, stage: item.stage, ...ACTIVE_WHERE } });
      if (existing && mode === 'append') {
        result.skipped += 1;
        continue;
      }

      const minted = await mintRubricVersionInTx(client, targetProgramId, item.stage, toMintPayload(item), null);
      if (!existing) result.created += 1;
      // Same id back means the target already matched: mint was a no-op.
      else if (minted.id === existing.id) result.skipped += 1;
      else result.replaced += 1;
    }
    return result;
  }
}
