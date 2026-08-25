// services/api/src/modules/programs/application/copy/copiers/faqs.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
};

type TemplateItem = { question: string; answer: string; category: string; isActive: boolean };

@Injectable()
export class FaqsCopier implements ProgramCopier {
  readonly key = 'faqs';
  readonly label = 'FAQs';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programFaq.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programFaq.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as FaqRow[]).map((f) => ({
      id: f.id,
      label: f.question,
      meta: f.category,
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programFaq as unknown as ScopedRowsDelegate<FaqRow>;
    return copyScopedRows<FaqRow>({
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
        answer: row.answer,
        category: row.category,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programFaq.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as FaqRow[]).map((r) => ({
      question: r.question,
      answer: r.answer,
      category: r.category,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: FaqRow[] = items.map((item, index) => ({
      id: '',
      question: item.question,
      answer: item.answer,
      category: item.category,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programFaq as unknown as ScopedRowsDelegate<FaqRow>;
    return applyScopedTemplate<FaqRow>({
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
        answer: row.answer,
        category: row.category,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
