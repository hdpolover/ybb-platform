import {
  MAGIC_FORM_FIELD_KEYS,
  MAGIC_FIELD_DEFINITIONS,
  isMagicFormFieldKey,
} from './magic-form-fields';

describe('magic-form-fields', () => {
  it('exposes the known magic keys', () => {
    expect(MAGIC_FORM_FIELD_KEYS).toEqual(
      expect.arrayContaining(['category', 'program_subtheme_id', 'program_id']),
    );
  });

  it('describes category as radio-type with its enum-backed behavior', () => {
    const def = MAGIC_FIELD_DEFINITIONS.find((d) => d.key === 'category');
    expect(def).toBeDefined();
    expect(def?.type).toBe('radio');
    expect(def?.behavior).toBe('application_category_enum');
  });

  it('describes program_subtheme_id with dynamic_subtheme_options behavior', () => {
    const def = MAGIC_FIELD_DEFINITIONS.find((d) => d.key === 'program_subtheme_id');
    expect(def?.behavior).toBe('dynamic_subtheme_options');
  });

  it('excludes program_id from the catalog picker', () => {
    const def = MAGIC_FIELD_DEFINITIONS.find((d) => d.key === 'program_id');
    expect(def?.catalogVisible).toBe(false);
  });

  it('isMagicFormFieldKey returns true for reserved keys and false otherwise', () => {
    expect(isMagicFormFieldKey('category')).toBe(true);
    expect(isMagicFormFieldKey('program_id')).toBe(true);
    expect(isMagicFormFieldKey('tshirt_size')).toBe(false);
    expect(isMagicFormFieldKey('')).toBe(false);
  });
});
