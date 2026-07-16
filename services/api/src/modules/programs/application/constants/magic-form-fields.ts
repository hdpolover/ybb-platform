export type MagicFieldBehavior =
  | 'application_category_enum'
  | 'dynamic_subtheme_options'
  | 'current_program_id';

export interface MagicFieldDefinition {
  key: string;
  label: string;
  type: 'radio' | 'select' | 'hidden';
  behavior: MagicFieldBehavior;
  category: 'program_structure';
  catalogVisible: boolean;
}

export const MAGIC_FIELD_DEFINITIONS: readonly MagicFieldDefinition[] = [
  {
    key: 'category',
    label: 'Application Category',
    type: 'radio',
    behavior: 'application_category_enum',
    category: 'program_structure',
    catalogVisible: true,
  },
  {
    key: 'program_subtheme_id',
    label: 'Subtheme Selection',
    type: 'select',
    behavior: 'dynamic_subtheme_options',
    category: 'program_structure',
    catalogVisible: true,
  },
  {
    key: 'program_id',
    label: 'Program ID',
    type: 'hidden',
    behavior: 'current_program_id',
    category: 'program_structure',
    catalogVisible: false,
  },
] as const;

export const MAGIC_FORM_FIELD_KEYS: readonly string[] = MAGIC_FIELD_DEFINITIONS.map(
  (d) => d.key,
);

const MAGIC_KEY_SET = new Set(MAGIC_FORM_FIELD_KEYS);

export function isMagicFormFieldKey(key: string): boolean {
  return MAGIC_KEY_SET.has(key);
}
