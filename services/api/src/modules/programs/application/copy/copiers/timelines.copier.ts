// services/api/src/modules/programs/application/copy/copiers/timelines.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

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

// date/endDate are JSON-serialized to ISO strings in the payload (JSON has
// no Date type — see template-payload.schemas.ts's dateTimeSchema comment).
// applyTemplate parses them back with `new Date(...)`.
type TemplateItem = {
  date: string;
  endDate: string | null;
  title: string;
  description: string | null;
  icon: string | null;
  type: string;
  completionType: string;
  completionConfig: unknown;
  targetAudience: string;
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

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programTimeline.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as TimelineRow[]).map((r) => ({
      date: r.date.toISOString(),
      endDate: r.endDate ? r.endDate.toISOString() : null,
      title: r.title,
      description: r.description,
      icon: r.icon,
      type: r.type,
      completionType: r.completionType,
      completionConfig: r.completionConfig,
      targetAudience: r.targetAudience,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: TimelineRow[] = items.map((item, index) => ({
      id: '',
      date: new Date(item.date),
      endDate: item.endDate ? new Date(item.endDate) : null,
      title: item.title,
      description: item.description,
      icon: item.icon,
      type: item.type,
      completionType: item.completionType,
      completionConfig: item.completionConfig,
      targetAudience: item.targetAudience,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programTimeline as unknown as ScopedRowsDelegate<TimelineRow>;
    return applyScopedTemplate<TimelineRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.title,
      fields: (row, order) => ({
        programId: targetProgramId,
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
