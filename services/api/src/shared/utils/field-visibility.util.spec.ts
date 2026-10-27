// services/api/src/shared/utils/field-visibility.util.spec.ts
import { filterVisibleFields, isFieldVisible } from './field-visibility.util';

const field = (name: string, visibleWhen?: unknown) => ({
    name,
    validationRules: visibleWhen === undefined ? {} : { visibleWhen },
});

describe('isFieldVisible', () => {
    it('is visible when there is no rule', () => {
        expect(isFieldVisible({}, {})).toBe(true);
        expect(isFieldVisible(null, {})).toBe(true);
    });

    it('shows only when the controlling field equals the value (case/space-insensitive)', () => {
        const rules = { visibleWhen: { field: 'is_alumni', equals: 'Yes' } };
        expect(isFieldVisible(rules, { is_alumni: ' yes ' })).toBe(true);
        expect(isFieldVisible(rules, { is_alumni: 'No' })).toBe(false);
        expect(isFieldVisible(rules, {})).toBe(false);
    });

    it('accepts a list of values', () => {
        const rules = { visibleWhen: { field: 'role', equals: ['a', 'b'] } };
        expect(isFieldVisible(rules, { role: 'b' })).toBe(true);
        expect(isFieldVisible(rules, { role: 'c' })).toBe(false);
    });

    it('matches multi-select answers when any selected value matches', () => {
        const rules = { visibleWhen: { field: 'tags', equals: 'x' } };
        expect(isFieldVisible(rules, { tags: ['y', 'x'] })).toBe(true);
        expect(isFieldVisible(rules, { tags: ['y'] })).toBe(false);
    });

    it('stringifies booleans', () => {
        expect(isFieldVisible({ visibleWhen: { field: 'f', equals: 'true' } }, { f: true })).toBe(true);
    });

    it('ignores a malformed rule instead of hiding the field', () => {
        expect(isFieldVisible({ visibleWhen: { field: '', equals: 'x' } }, {})).toBe(true);
        expect(isFieldVisible({ visibleWhen: { field: 'f' } }, {})).toBe(true);
        expect(isFieldVisible({ visibleWhen: 'nope' }, {})).toBe(true);
    });
});

describe('filterVisibleFields', () => {
    const fields = [
        field('is_alumni'),
        field('alumni_program', { field: 'is_alumni', equals: 'Yes' }),
        field('alumni_year', { field: 'alumni_program', equals: ['IYS', 'KYS'] }),
    ];

    it('hides a dependent when its visible controller does not match', () => {
        const names = filterVisibleFields(fields, { is_alumni: 'No' }).map((f) => f.name);
        // alumni_year hangs off the now-hidden alumni_program, so it fails closed to visible.
        expect(names).toEqual(['is_alumni', 'alumni_year']);
    });

    it('keeps a field visible when its controller is itself hidden (fail closed)', () => {
        const names = filterVisibleFields(fields, { is_alumni: 'No', alumni_program: 'IYS' }).map((f) => f.name);
        expect(names).toEqual(['is_alumni', 'alumni_year']);
    });

    it('keeps a field visible when the controller is not in the in-scope field set, even if a crafted value exists', () => {
        const orphan = [field('alumni_program', { field: 'is_alumni', equals: 'Yes' })];
        const names = filterVisibleFields(orphan, { is_alumni: 'No' }).map((f) => f.name);
        expect(names).toEqual(['alumni_program']);
    });

    it('shows the whole chain when every link matches', () => {
        const names = filterVisibleFields(fields, { is_alumni: 'Yes', alumni_program: 'KYS' }).map((f) => f.name);
        expect(names).toEqual(['is_alumni', 'alumni_program', 'alumni_year']);
    });

    it('keeps every field visible on circular rules', () => {
        const cyclic = [field('a', { field: 'b', equals: '1' }), field('b', { field: 'a', equals: '1' })];
        expect(filterVisibleFields(cyclic, { a: '0', b: '0' }).map((f) => f.name)).toEqual(['a', 'b']);
    });
});
