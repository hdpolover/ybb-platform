import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { GetApplicationFormFieldsQuery } from '../get-application-form-fields.query';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

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

function normalizeOptions(raw: unknown): unknown {
  let source: unknown = raw;

  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        // Keep original string fallback.
      }
    }
  }

  if (Array.isArray(source)) {
    return source.length > 0 ? source : undefined;
  }

  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const rec = source as Record<string, unknown>;
  if (Array.isArray(rec.options)) {
    return rec.options.length > 0 ? rec.options : undefined;
  }

  return Object.keys(rec).length > 0 ? rec : undefined;
}

@QueryHandler(GetApplicationFormFieldsQuery)
export class GetApplicationFormFieldsHandler implements IQueryHandler<GetApplicationFormFieldsQuery> {
  constructor(
    @Inject('IProgramContentRepository')
    private readonly repository: IProgramContentRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetApplicationFormFieldsQuery) {
    const { programId } = query;
    const fields = await this.repository.findFormFieldsByProgramId(programId);

    const defaultOptionLookupKeys = Array.from(
      new Set(
        fields
          .map((field) => [field.systemFieldKey, field.name])
          .flat()
          .filter((key): key is string => typeof key === 'string' && key.length > 0),
      ),
    );

    const systemDefaultsByKey = new Map<string, unknown>();
    if (defaultOptionLookupKeys.length > 0) {
      const definitions = await this.prisma.systemFormFieldDefinition.findMany({
        where: {
          key: { in: defaultOptionLookupKeys },
          deletedAt: null,
        },
        select: {
          key: true,
          defaultOptions: true,
        },
      });

      for (const definition of definitions) {
        systemDefaultsByKey.set(definition.key, definition.defaultOptions);
      }
    }

    return fields.map(field => ({
      id: field.id,
      section: field.section,
      fieldName: field.name,
      source: field.source,
      systemFieldKey: field.systemFieldKey || undefined,
      label: field.label,
      placeholder: field.placeholder || undefined,
      helpText: field.helpText || undefined,
      mediaUrl: field.mediaUrl || undefined,
      mediaAlt: field.mediaAlt || undefined,
      helpAssets: normalizeHelpAssets(field.helpAssets),
      fieldType: field.type,
      isRequired: field.isRequired,
      options:
        normalizeOptions(field.options)
        ?? normalizeOptions(systemDefaultsByKey.get(field.systemFieldKey || field.name)),
      validationRules: field.validationRules || undefined,
      defaultValue:
        field.validationRules && typeof field.validationRules === 'object' && !Array.isArray(field.validationRules)
          ? (field.validationRules as Record<string, unknown>).defaultValue as string | undefined
          : undefined,
      order: field.order,
    }));
  }
}
