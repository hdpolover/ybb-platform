export interface CatalogEntry {
  type: string;
  defaultOptions?: unknown;
}

export interface ReconcilableField {
  id: string;
  systemFieldKey: string | null;
  type: string;
  options: unknown;
}

export interface FieldTypeFix {
  id: string;
  key: string;
  fromType: string;
  toType: string;
  fillOptions: boolean;
  newOptions?: unknown;
}

function isEmptyOptions(options: unknown): boolean {
  return (
    options === null ||
    options === undefined ||
    (Array.isArray(options) && options.length === 0)
  );
}

/**
 * Given the live system fields of one or more programs and the canonical
 * catalog (keyed by system field key), return the set of fields whose `type`
 * diverges from the catalog, or whose options are empty while the catalog
 * defines defaults. Pure and idempotent: a field already in sync yields no fix.
 */
export function computeSystemFieldTypeFixes(
  fields: ReconcilableField[],
  catalogByKey: Map<string, CatalogEntry>,
): FieldTypeFix[] {
  const fixes: FieldTypeFix[] = [];
  for (const field of fields) {
    if (!field.systemFieldKey) continue;
    const entry = catalogByKey.get(field.systemFieldKey);
    if (!entry) continue;

    const typeDiffers = field.type !== entry.type;
    const catalogHasOptions =
      Array.isArray(entry.defaultOptions) && entry.defaultOptions.length > 0;
    const fillOptions = isEmptyOptions(field.options) && catalogHasOptions;

    if (!typeDiffers && !fillOptions) continue;

    fixes.push({
      id: field.id,
      key: field.systemFieldKey,
      fromType: field.type,
      toType: entry.type,
      fillOptions,
      ...(fillOptions ? { newOptions: entry.defaultOptions } : {}),
    });
  }
  return fixes;
}
