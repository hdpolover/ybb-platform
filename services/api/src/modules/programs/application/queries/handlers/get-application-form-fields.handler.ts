import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { GetApplicationFormFieldsQuery } from '../get-application-form-fields.query';

const HELP_ASSET_KINDS = new Set(['link', 'video', 'file']);

type HelpAsset = { kind: 'link' | 'video' | 'file'; label: string; url: string };

function normalizeHelpAssets(raw: unknown): HelpAsset[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: HelpAsset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (
      typeof rec.kind !== 'string' ||
      !HELP_ASSET_KINDS.has(rec.kind) ||
      typeof rec.label !== 'string' ||
      typeof rec.url !== 'string'
    ) {
      continue;
    }
    out.push({ kind: rec.kind as HelpAsset['kind'], label: rec.label, url: rec.url });
  }
  return out.length > 0 ? out : undefined;
}

@QueryHandler(GetApplicationFormFieldsQuery)
export class GetApplicationFormFieldsHandler implements IQueryHandler<GetApplicationFormFieldsQuery> {
  constructor(
    @Inject('IProgramContentRepository')
    private readonly repository: IProgramContentRepository,
  ) {}

  async execute(query: GetApplicationFormFieldsQuery) {
    const { programId } = query;
    const fields = await this.repository.findFormFieldsByProgramId(programId);

    return fields.map(field => ({
      id: field.id,
      section: field.section,
      fieldName: field.name,
      label: field.label,
      placeholder: field.placeholder || undefined,
      helpText: field.helpText || undefined,
      mediaUrl: field.mediaUrl || undefined,
      mediaAlt: field.mediaAlt || undefined,
      helpAssets: normalizeHelpAssets(field.helpAssets),
      fieldType: field.type,
      isRequired: field.isRequired,
      options: field.options || undefined,
      validationRules: field.validationRules || undefined,
      defaultValue:
        field.validationRules && typeof field.validationRules === 'object' && !Array.isArray(field.validationRules)
          ? (field.validationRules as Record<string, unknown>).defaultValue as string | undefined
          : undefined,
      order: field.order,
    }));
  }
}
