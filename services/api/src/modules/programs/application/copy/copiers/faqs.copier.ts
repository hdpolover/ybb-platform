// services/api/src/modules/programs/application/copy/copiers/faqs.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
};

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
}
