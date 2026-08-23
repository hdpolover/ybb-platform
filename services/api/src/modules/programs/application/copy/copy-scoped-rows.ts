// services/api/src/modules/programs/application/copy/copy-scoped-rows.ts
import { BadRequestException } from '@nestjs/common';
import { CopyMode, CopyResult } from './program-copier.interface';

/**
 * Minimal duck-typed slice of a Prisma model delegate. Deliberately not the
 * generated Prisma delegate type: the five callers (form fields, participation
 * categories, timelines, rundowns, FAQs) each have a different row shape, so
 * each copier casts its real `tx.<model>` delegate into this shape at the
 * call site (`as unknown as ScopedRowsDelegate<Row>`) rather than
 * copyScopedRows assuming a schema. This mirrors the existing `as never`
 * casts in copy-fields-from-program.handler.ts for the same reason: Prisma's
 * generated types are too specific to share across five different models.
 */
export interface ScopedRowsDelegate<Row> {
  findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, unknown> }): Promise<Row[]>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  create(args: { data: Record<string, unknown> }): Promise<Row>;
}

export interface CopyScopedRowsConfig<Row> {
  delegate: ScopedRowsDelegate<Row>;
  scopeField: string;
  sourceProgramId: string;
  targetProgramId: string;
  itemIds?: string[];
  mode: CopyMode;
  /** Extra where-clauses beyond scopeField, e.g. { deletedAt: null }. */
  activeFilter: Record<string, unknown>;
  idOf: (row: Row) => string;
  dedupeKey: (row: Row) => string;
  fields: (row: Row, order: number) => Record<string, unknown>;
  /** Data passed to updateMany when mode === 'replace'. */
  replaceData: Record<string, unknown>;
  /**
   * Optional integrity guard run with the target's current live row ids
   * before the replace-mode soft-delete executes. Throw to abort the whole
   * copy before any mutation happens. Only participation-categories uses
   * this today (refusing replace when applications still reference a
   * category); every other copier omits it.
   */
  beforeReplace?: (existingIds: string[]) => Promise<void>;
}

export async function copyScopedRows<Row>(config: CopyScopedRowsConfig<Row>): Promise<CopyResult> {
  const {
    delegate, scopeField, sourceProgramId, targetProgramId, itemIds, mode,
    activeFilter, idOf, dedupeKey, fields, replaceData, beforeReplace,
  } = config;

  let sourceRows = await delegate.findMany({
    where: { [scopeField]: sourceProgramId, ...activeFilter },
    orderBy: { order: 'asc' },
  });

  if (itemIds && itemIds.length > 0) {
    const idSet = new Set(itemIds);
    sourceRows = sourceRows.filter((row) => idSet.has(idOf(row)));
  }

  // Replace mode soft-deletes every current target row unconditionally, then
  // inserts sourceRows. If sourceRows is empty here — either the source has
  // nothing active, or an itemIds selection filtered it down to nothing —
  // that soft-delete would destroy the target's content with nothing to
  // replace it. copy-fields-from-program.handler.ts guarded exactly this
  // case (its `no_fields` 400, thrown before any mutation); mirror that here
  // so all seven copiers built on this helper get the guard, not just forms.
  // Append mode is unaffected: an empty source there is a legitimate no-op.
  if (mode === 'replace' && sourceRows.length === 0) {
    throw new BadRequestException({
      code: 'empty_replace_source',
      message:
        "Replacing from an empty selection would delete the target's existing content without replacing it. Select at least one item to copy, or use append mode.",
    });
  }

  // Always load the target's current live rows: append needs them for the
  // dedupe set + order baseline, replace needs them for the integrity guard
  // and to know what it is about to soft-delete.
  const existingRows = await delegate.findMany({
    where: { [scopeField]: targetProgramId, ...activeFilter },
  });

  let replaced = 0;
  if (mode === 'replace') {
    if (beforeReplace) {
      await beforeReplace(existingRows.map(idOf));
    }
    const result = await delegate.updateMany({
      where: { [scopeField]: targetProgramId, ...activeFilter },
      data: replaceData,
    });
    replaced = result.count;
  }

  const existingKeys = new Set(mode === 'append' ? existingRows.map(dedupeKey) : []);
  // order is a plain int column on every one of these models; base it on the
  // current max so appended rows land after what's already there — matches
  // copy-fields-from-program.handler.ts, which admins already know.
  const baseOrder =
    mode === 'append'
      ? existingRows.reduce((max, row) => Math.max(max, (row as { order: number }).order), -1) + 1
      : 0;

  let created = 0;
  let skipped = 0;
  let placed = 0;

  for (const row of sourceRows) {
    const key = dedupeKey(row);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    await delegate.create({ data: fields(row, baseOrder + placed) });
    existingKeys.add(key);
    created += 1;
    placed += 1;
  }

  return { created, skipped, replaced };
}
