// services/api/src/modules/programs/application/copy/copiers/essays.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type EssayRow = {
  id: string;
  question: string;
  description: string | null;
  wordLimit: number | null;
  isRequired: boolean;
  order: number;
  isActive: boolean;
  allowedCategories: string[];
};

type TemplateItem = {
  question: string;
  description: string | null;
  wordLimit: number | null;
  isRequired: boolean;
  isActive: boolean;
  allowedCategories: string[];
};

@Injectable()
export class EssaysCopier implements ProgramCopier {
  readonly key = 'essays';
  readonly label = 'Essays';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programEssay.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programEssay.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as EssayRow[]).map((e) => ({
      id: e.id,
      label: e.question,
      meta: e.isRequired ? 'Required' : 'Optional',
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programEssay as unknown as ScopedRowsDelegate<EssayRow>;
    return copyScopedRows<EssayRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.question,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        question: row.question,
        description: row.description,
        wordLimit: row.wordLimit,
        isRequired: row.isRequired,
        order,
        isActive: row.isActive,
        allowedCategories: row.allowedCategories,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programEssay.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as EssayRow[]).map((r) => ({
      question: r.question,
      description: r.description,
      wordLimit: r.wordLimit,
      isRequired: r.isRequired,
      isActive: r.isActive,
      allowedCategories: r.allowedCategories,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: EssayRow[] = items.map((item, index) => ({
      id: '',
      question: item.question,
      description: item.description,
      wordLimit: item.wordLimit,
      isRequired: item.isRequired,
      order: index,
      isActive: item.isActive,
      allowedCategories: item.allowedCategories,
    }));
    const delegate = tx.programEssay as unknown as ScopedRowsDelegate<EssayRow>;
    return applyScopedTemplate<EssayRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.question,
      fields: (row, order) => ({
        programId: targetProgramId,
        question: row.question,
        description: row.description,
        wordLimit: row.wordLimit,
        isRequired: row.isRequired,
        order,
        isActive: row.isActive,
        allowedCategories: row.allowedCategories,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
