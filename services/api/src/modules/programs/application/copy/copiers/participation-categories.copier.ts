// services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

// description/benefits/eligibility are edited with the Tiptap rich-text
// editor (rich-text-editor.tsx, same one program-details.copier.ts guards
// against) and can embed `<img src="...">` pointing at the source brand's
// storage. Mirrors form-fields.copier.ts's hasExternalMedia — the shared
// copy dialog shows a cross-brand caveat when any selected item flags this.
const EXTERNAL_MEDIA_PATTERN = /<(img|iframe|video)\b/i;

function hasExternalMedia(row: { description: string | null; benefits: string | null; eligibility: string | null }): boolean {
  return [row.description, row.benefits, row.eligibility].some(
    (value) => value !== null && EXTERNAL_MEDIA_PATTERN.test(value),
  );
}

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  benefits: string | null;
  eligibility: string | null;
  order: number;
  isActive: boolean;
};

type TemplateItem = {
  name: string;
  description: string | null;
  benefits: string | null;
  eligibility: string | null;
  isActive: boolean;
};

// Same guard reasoning as deleteParticipationCategory (Task 4) — a hard
// dependency on ParticipantApplication.participationCategoryId with no
// onDelete clause. Shared by copy() and applyTemplate()'s beforeReplace so
// the two entry points can never drift on what "in use" means.
async function refuseIfInUse(tx: PrismaTx, existingIds: string[]): Promise<void> {
  if (existingIds.length === 0) return;
  const referencedCount = await tx.participantApplication.count({
    where: { participationCategoryId: { in: existingIds } },
  });
  if (referencedCount > 0) {
    throw new ConflictException({
      code: 'category_in_use',
      message: `Cannot replace: ${referencedCount} application(s) still reference the current participation categories. Use append mode instead, or reassign those applications first.`,
    });
  }
}

@Injectable()
export class ParticipationCategoriesCopier implements ProgramCopier {
  readonly key = 'participation-categories';
  readonly label = 'Participation Categories';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programParticipationCategory.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const categories = await this.prisma.programParticipationCategory.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (categories as unknown as CategoryRow[]).map((c) => ({
      id: c.id,
      label: c.name,
      meta: c.isActive ? 'Active' : 'Inactive',
      hasExternalMedia: hasExternalMedia(c),
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programParticipationCategory as unknown as ScopedRowsDelegate<CategoryRow>;
    return copyScopedRows<CategoryRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        name: row.name,
        description: row.description,
        benefits: row.benefits,
        eligibility: row.eligibility,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
      // Applied here to the bulk replace case: refuse to soft-delete the
      // target's current categories while any application still references
      // them, regardless of that application's status.
      beforeReplace: (existingIds) => refuseIfInUse(tx, existingIds),
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programParticipationCategory.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as CategoryRow[]).map((r) => ({
      name: r.name,
      description: r.description,
      benefits: r.benefits,
      eligibility: r.eligibility,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: CategoryRow[] = items.map((item, index) => ({
      id: '',
      name: item.name,
      description: item.description,
      benefits: item.benefits,
      eligibility: item.eligibility,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programParticipationCategory as unknown as ScopedRowsDelegate<CategoryRow>;
    return applyScopedTemplate<CategoryRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: targetProgramId,
        name: row.name,
        description: row.description,
        benefits: row.benefits,
        eligibility: row.eligibility,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
      beforeReplace: (existingIds) => refuseIfInUse(tx, existingIds),
    });
  }
}
