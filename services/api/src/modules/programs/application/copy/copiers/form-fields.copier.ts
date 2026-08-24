// services/api/src/modules/programs/application/copy/copiers/form-fields.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';

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
}
