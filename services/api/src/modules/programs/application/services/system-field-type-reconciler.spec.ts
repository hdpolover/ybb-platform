import {
  computeSystemFieldTypeFixes,
  type CatalogEntry,
  type ReconcilableField,
} from './system-field-type-reconciler';

const catalog = new Map<string, CatalogEntry>([
  ['phone', { type: 'phone', defaultOptions: [] }],
  ['nationality', { type: 'country', defaultOptions: [] }],
  ['gender', {
    type: 'radio',
    defaultOptions: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
    ],
  }],
]);

describe('computeSystemFieldTypeFixes', () => {
  it('emits a fix when a system field type diverges from the catalog', () => {
    const fields: ReconcilableField[] = [
      { id: 'f1', systemFieldKey: 'phone', type: 'text', options: [] },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([
      { id: 'f1', key: 'phone', fromType: 'text', toType: 'phone', fillOptions: false },
    ]);
  });

  it('emits no fix when type already matches and options are non-empty (idempotent)', () => {
    const fields: ReconcilableField[] = [
      { id: 'f2', systemFieldKey: 'phone', type: 'phone', options: [] },
      {
        id: 'f3',
        systemFieldKey: 'gender',
        type: 'radio',
        options: [{ label: 'Male', value: 'male' }],
      },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([]);
  });

  it('fills options from the catalog when the field options are empty', () => {
    const fields: ReconcilableField[] = [
      { id: 'f4', systemFieldKey: 'gender', type: 'radio', options: [] },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([
      {
        id: 'f4',
        key: 'gender',
        fromType: 'radio',
        toType: 'radio',
        fillOptions: true,
        newOptions: [
          { label: 'Male', value: 'male' },
          { label: 'Female', value: 'female' },
        ],
      },
    ]);
  });

  it('skips fields with a null systemFieldKey (custom fields)', () => {
    const fields: ReconcilableField[] = [
      { id: 'f5', systemFieldKey: null, type: 'text', options: [] },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([]);
  });

  it('skips fields whose key is absent from the catalog', () => {
    const fields: ReconcilableField[] = [
      { id: 'f6', systemFieldKey: 'unknown_key', type: 'text', options: [] },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([]);
  });
});
