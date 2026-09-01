// services/api/src/modules/programs/application/copy/copiers/sub-themes.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type SubThemeRow = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
};

type TemplateItem = { name: string; description: string | null; isActive: boolean };

@Injectable()
export class SubThemesCopier implements ProgramCopier {
  readonly key = 'sub-themes';
  readonly label = 'Sub Themes';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programSubtheme.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programSubtheme.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as SubThemeRow[]).map((s) => ({
      id: s.id,
      label: s.name,
      meta: s.isActive ? 'Active' : 'Inactive',
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programSubtheme as unknown as ScopedRowsDelegate<SubThemeRow>;
    return copyScopedRows<SubThemeRow>({
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
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programSubtheme.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as SubThemeRow[]).map((r) => ({
      name: r.name,
      description: r.description,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: SubThemeRow[] = items.map((item, index) => ({
      id: '',
      name: item.name,
      description: item.description,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programSubtheme as unknown as ScopedRowsDelegate<SubThemeRow>;
    return applyScopedTemplate<SubThemeRow>({
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
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
