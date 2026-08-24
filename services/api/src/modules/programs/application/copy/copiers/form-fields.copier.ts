// services/api/src/modules/programs/application/copy/copiers/form-fields.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type FormFieldRow = {
  id: string;
  name: string;
  label: string;
  type: string;
  section: string;
  isRequired: boolean;
  order: number;
  placeholder: string | null;
  helpText: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  helpAssets: unknown;
  options: unknown;
  validationRules: unknown;
  source: string;
  systemFieldKey: string | null;
};

// The thin exported shape for a system-sourced item — deliberately missing
// label/type/helpText/options (see program-copier.interface.ts's
// TemplatePayload doc and template-payload.schemas.ts's formFieldsItemSchema
// comment). `order` IS included for both variants: formFieldsItemSchema
// declares it as a required z.number() (unlike the other six entityTypes,
// which recompute order positionally inside copyScopedRows/applyScopedTemplate
// and never carry it in their payload) — so it must be exported, not omitted.
// The full shape (custom items, or migrated legacy items carrying
// labelOverride/helpTextOverride) is validated by the same schema, which
// makes every field but source/section/isRequired/order optional.
type TemplateItem = {
  source: 'system' | 'custom';
  systemFieldKey?: string | null;
  name?: string | null;
  label?: string | null;
  type?: string | null;
  placeholder?: string | null;
  helpText?: string | null;
  options?: unknown;
  validationRules?: unknown;
  section: string;
  isRequired: boolean;
  order: number;
  labelOverride?: string | null;
  helpTextOverride?: string | null;
};

@Injectable()
export class FormFieldsCopier implements ProgramCopier {
  readonly key = 'form-fields';
  readonly label = 'Application Form Fields';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.applicationFormField.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const fields = await this.prisma.applicationFormField.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (fields as unknown as FormFieldRow[]).map((f) => ({
      id: f.id,
      label: f.label,
      meta: `${f.name} · ${f.type}${f.section ? ` · ${f.section}` : ''}`,
      // Media and help assets are copied verbatim by design; the shared
      // dialog shows a cross-brand caveat when any selected item flags this.
      hasExternalMedia: Boolean(f.mediaUrl) || (Array.isArray(f.helpAssets) && f.helpAssets.length > 0),
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.applicationFormField as unknown as ScopedRowsDelegate<FormFieldRow>;
    return copyScopedRows<FormFieldRow>({
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
        label: row.label,
        type: row.type,
        section: row.section,
        isRequired: row.isRequired,
        order,
        placeholder: row.placeholder,
        helpText: row.helpText,
        // Media and help assets are copied verbatim by design; when the source
        // is a different brand the admin UI shows a cross-brand caveat.
        mediaUrl: row.mediaUrl,
        mediaAlt: row.mediaAlt,
        helpAssets: (row.helpAssets as never) ?? [],
        options: (row.options as never) ?? [],
        validationRules: (row.validationRules as never) ?? {},
        source: row.source,
        systemFieldKey: row.systemFieldKey,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.applicationFormField.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as FormFieldRow[]).map((row) => {
      if (row.source === 'system') {
        // Thin on purpose — see template-payload.schemas.ts's
        // formFieldsItemSchema comment. label/type/helpText/options are
        // never exported for a system field; applyTemplate always
        // re-resolves them from SystemFormFieldDefinition at apply time.
        return {
          source: 'system',
          systemFieldKey: row.systemFieldKey,
          section: row.section,
          isRequired: row.isRequired,
          order: row.order,
        };
      }
      return {
        source: 'custom',
        name: row.name,
        label: row.label,
        type: row.type,
        placeholder: row.placeholder,
        helpText: row.helpText,
        options: row.options,
        validationRules: row.validationRules,
        section: row.section,
        isRequired: row.isRequired,
        order: row.order,
      };
    });
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const delegate = tx.applicationFormField as unknown as ScopedRowsDelegate<FormFieldRow>;

    // Ports apply-form-template.handler.ts's resolution algorithm verbatim —
    // per the spec, this must not be generalised (no other entity has a
    // catalog). `resolved` carries the exact same three-way precedence that
    // handler used: labelOverride/helpTextOverride win when set; type always
    // follows the catalog for system fields; options only falls back to the
    // catalog's defaultOptions when the item's own options are empty/absent.
    //
    // catalogSkipped counts items dropped here (missing/inactive/deleted
    // catalog entry) so they land in CopyResult.skipped — mirroring
    // apply-form-template.handler.ts, where `skipped.push(computedName)` is
    // reached for this exact case, not just for a dedupe collision. The
    // shared applyScopedTemplate core only ever sees `resolved`, so it can
    // only count dedupe-collision skips on its own; this half of the total
    // has to be tracked here and folded into the result below.
    let catalogSkipped = 0;
    const resolved: FormFieldRow[] = [];
    for (const item of items) {
      if (item.source === 'system' && item.systemFieldKey) {
        const def = await tx.systemFormFieldDefinition.findUnique({ where: { key: item.systemFieldKey } });
        if (!def || !def.isActive || def.deletedAt) {
          // Matches apply-form-template.handler.ts: an item whose catalog
          // entry is gone/inactive is skipped, not an error — the rest of
          // the template still applies.
          catalogSkipped += 1;
          continue;
        }
        const label = item.labelOverride ?? def.label;
        const options = item.options && (!Array.isArray(item.options) || (item.options as unknown[]).length > 0) ? item.options : def.defaultOptions;
        const helpText = item.helpTextOverride ?? def.helpText;
        resolved.push({
          id: '',
          name: item.systemFieldKey,
          label,
          type: def.type,
          section: item.section,
          isRequired: item.isRequired,
          order: item.order,
          placeholder: item.placeholder ?? null,
          helpText: helpText ?? null,
          mediaUrl: null,
          mediaAlt: null,
          helpAssets: [],
          options: (options as never) ?? [],
          validationRules: (item.validationRules as never) ?? {},
          source: 'system',
          systemFieldKey: item.systemFieldKey,
        });
      } else if (item.source === 'custom' && item.name) {
        resolved.push({
          id: '',
          name: item.name,
          label: item.label ?? item.name,
          type: item.type ?? 'text',
          section: item.section,
          isRequired: item.isRequired,
          order: item.order,
          placeholder: item.placeholder ?? null,
          helpText: item.helpText ?? null,
          mediaUrl: null,
          mediaAlt: null,
          helpAssets: [],
          options: (item.options as never) ?? [],
          validationRules: (item.validationRules as never) ?? {},
          source: 'custom',
          systemFieldKey: null,
        });
      }
    }

    const result = await applyScopedTemplate<FormFieldRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows: resolved,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: targetProgramId,
        name: row.name,
        label: row.label,
        type: row.type,
        section: row.section,
        isRequired: row.isRequired,
        order,
        placeholder: row.placeholder,
        helpText: row.helpText,
        mediaUrl: row.mediaUrl,
        mediaAlt: row.mediaAlt,
        helpAssets: (row.helpAssets as never) ?? [],
        options: (row.options as never) ?? [],
        validationRules: (row.validationRules as never) ?? {},
        source: row.source,
        systemFieldKey: row.systemFieldKey,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
    return { ...result, skipped: result.skipped + catalogSkipped };
  }
}
