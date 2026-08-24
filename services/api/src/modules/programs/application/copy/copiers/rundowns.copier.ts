// services/api/src/modules/programs/application/copy/copiers/rundowns.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type RundownRow = {
  id: string;
  day: string;
  startTime: string | null;
  endTime: string | null;
  activity: string;
  description: string | null;
  location: string | null;
  speaker: string | null;
  order: number;
  isActive: boolean;
};

type TemplateItem = {
  day: string;
  startTime: string | null;
  endTime: string | null;
  activity: string;
  description: string | null;
  location: string | null;
  speaker: string | null;
  isActive: boolean;
};

// The backend model for "rundowns" is ProgramSchedule — it has no title
// column, so the dedupe key is the composite (day, activity) rather than a
// single field. `day` and `activity` are both free-text VarChar columns
// (CreateProgramScheduleDto only enforces @IsString() @IsNotEmpty(), no
// character restriction), so a fixed separator like "::" cannot be assumed
// absent from either value — e.g. day="Day1::Extra", activity="Foo" and
// day="Day1", activity="Extra::Foo" would both naively concatenate to
// "Day1::Extra::Foo". Length-prefixing `day` makes the boundary unambiguous
// regardless of content: given the exact character count of `day`, the two
// fields can always be told apart, so two distinct (day, activity) pairs can
// never produce the same key.
function dedupeKey(row: RundownRow): string {
  return `${row.day.length}:${row.day}:${row.activity}`;
}

@Injectable()
export class RundownsCopier implements ProgramCopier {
  readonly key = 'rundowns';
  readonly label = 'Program Rundowns';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programSchedule.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programSchedule.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as RundownRow[]).map((r) => ({
      id: r.id,
      label: r.activity,
      meta: r.day,
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programSchedule as unknown as ScopedRowsDelegate<RundownRow>;
    return copyScopedRows<RundownRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        day: row.day,
        startTime: row.startTime,
        endTime: row.endTime,
        activity: row.activity,
        description: row.description,
        location: row.location,
        speaker: row.speaker,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programSchedule.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as RundownRow[]).map((r) => ({
      day: r.day,
      startTime: r.startTime,
      endTime: r.endTime,
      activity: r.activity,
      description: r.description,
      location: r.location,
      speaker: r.speaker,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: RundownRow[] = items.map((item, index) => ({
      id: '',
      day: item.day,
      startTime: item.startTime,
      endTime: item.endTime,
      activity: item.activity,
      description: item.description,
      location: item.location,
      speaker: item.speaker,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programSchedule as unknown as ScopedRowsDelegate<RundownRow>;
    return applyScopedTemplate<RundownRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      // Reuses the exact same composite dedupeKey copy() uses (defined once
      // above) — see this file's module-level comment on why a naive
      // "day::activity" concat is unsafe. Both entry points share this
      // single function so they can never drift.
      dedupeKey,
      fields: (row, order) => ({
        programId: targetProgramId,
        day: row.day,
        startTime: row.startTime,
        endTime: row.endTime,
        activity: row.activity,
        description: row.description,
        location: row.location,
        speaker: row.speaker,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
