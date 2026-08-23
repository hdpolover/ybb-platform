// services/api/src/modules/programs/application/copy/copiers/timelines.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';

type TimelineRow = {
  id: string;
  date: Date;
  endDate: Date | null;
  title: string;
  description: string | null;
  icon: string | null;
  type: string;
  completionType: string;
  completionConfig: unknown;
  targetAudience: string;
  order: number;
  isActive: boolean;
};

@Injectable()
export class TimelinesCopier implements ProgramCopier {
  readonly key = 'timelines';
  readonly label = 'Timelines';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programTimeline.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programTimeline.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as TimelineRow[]).map((t) => ({
      id: t.id,
      label: t.title,
      meta: t.date.toISOString().slice(0, 10),
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programTimeline as unknown as ScopedRowsDelegate<TimelineRow>;
    return copyScopedRows<TimelineRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.title,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        date: row.date,
        endDate: row.endDate,
        title: row.title,
        description: row.description,
        icon: row.icon,
        type: row.type,
        completionType: row.completionType,
        completionConfig: (row.completionConfig as never) ?? {},
        targetAudience: row.targetAudience,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
