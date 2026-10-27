// services/api/src/shared/utils/field-visibility.util.ts

/**
 * Conditional visibility for application_form_fields. The rule lives in
 * validation_rules as `visibleWhen: { field, equals }`; a field whose rule does
 * not match is hidden: not rendered, not required, excluded from completeness.
 * Answers already saved for a hidden field are left alone, just ignored.
 * Pass values built only from the in-scope fields (see filterVisibleFields).
 *
 * Mirror: ybb-program-next/lib/form-field-visibility.ts (keep the two in sync).
 */
export interface VisibleWhenRule {
    field: string;
    equals: string | string[];
}

interface FieldWithRules {
    name: string;
    validationRules?: unknown;
}

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();

function readRule(rules: unknown): VisibleWhenRule | null {
    if (!rules || typeof rules !== 'object') return null;
    const rule = (rules as { visibleWhen?: unknown }).visibleWhen;
    if (!rule || typeof rule !== 'object') return null;
    const { field, equals } = rule as Partial<VisibleWhenRule>;
    if (typeof field !== 'string' || !field) return null;
    if (typeof equals !== 'string' && !Array.isArray(equals)) return null;
    return { field, equals };
}

/** Single-field check against the current answers (ignores whether the controller is itself hidden). */
export function isFieldVisible(rules: unknown, values: Record<string, unknown>): boolean {
    const rule = readRule(rules);
    if (!rule) return true;
    const expected = (Array.isArray(rule.equals) ? rule.equals : [rule.equals]).map(normalize);
    const actual = values[rule.field];
    const actualList = Array.isArray(actual) ? actual : [actual];
    return actualList.some((item) => item != null && expected.includes(normalize(item)));
}

/**
 * Keeps visible fields only. Fails closed for the submit gate: a field is hidden
 * only when its controller is in `fields` (the caller's active, category-scoped
 * set), is itself visible, and does not match. A missing/inactive/out-of-scope
 * controller, a hidden controller, or a rule cycle all leave the field VISIBLE,
 * so its required-ness still applies. `values` is read only for in-scope
 * controllers, so stray personal_data keys can never hide anything.
 */
export function filterVisibleFields<T extends FieldWithRules>(fields: T[], values: Record<string, unknown>): T[] {
    const byName = new Map(fields.map((field) => [field.name, field]));
    const controllerOf = (field: T): T | undefined => {
        const rule = readRule(field.validationRules);
        return rule ? byName.get(rule.field) : undefined;
    };
    const hasCycle = (field: T): boolean => {
        const seen = new Set<string>();
        for (let current: T | undefined = field; current; current = controllerOf(current)) {
            if (seen.has(current.name)) return true;
            seen.add(current.name);
        }
        return false;
    };
    const isHidden = (field: T): boolean => {
        const controller = controllerOf(field);
        if (!controller || hasCycle(field)) return false;
        if (isHidden(controller)) return false;
        return !isFieldVisible(field.validationRules, values);
    };

    return fields.filter((field) => !isHidden(field));
}
