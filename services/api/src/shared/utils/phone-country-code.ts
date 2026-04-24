import { Country } from 'country-state-city';

export type PhoneCountryCodeNormalizationResult = {
    value: string | null | undefined;
    changed: boolean;
    resolved: boolean;
    reason: 'empty' | 'country_identity' | 'numeric' | 'unresolved';
};

type PhoneCountryCodeMaps = {
    isoToDial: Map<string, string>;
    nameToDial: Map<string, string>;
    dialDigitsByLengthDesc: string[];
};

const COUNTRY_NAME_ALIASES: Record<string, string> = {
    turkiye: 'TR',
    usa: 'US',
    unitedstatesofamerica: 'US',
    uk: 'GB',
    uae: 'AE',
};

let cachedMaps: PhoneCountryCodeMaps | null = null;

function normalizeToken(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function getPhoneCountryCodeMaps(): PhoneCountryCodeMaps {
    if (cachedMaps) return cachedMaps;

    const isoToDial = new Map<string, string>();
    const nameToDial = new Map<string, string>();
    const dialDigits = new Set<string>();

    for (const country of Country.getAllCountries()) {
        const iso = (country.isoCode || '').toUpperCase();
        const nameKey = normalizeToken(country.name || '');
        const digits = String(country.phonecode || '').replace(/\D+/g, '');

        if (!iso || !digits) continue;

        const dial = `+${digits}`;
        if (!isoToDial.has(iso)) isoToDial.set(iso, dial);
        if (nameKey && !nameToDial.has(nameKey)) nameToDial.set(nameKey, dial);
        dialDigits.add(digits);
    }

    for (const [alias, iso] of Object.entries(COUNTRY_NAME_ALIASES)) {
        const dial = isoToDial.get(iso);
        if (dial) nameToDial.set(alias, dial);
    }

    cachedMaps = {
        isoToDial,
        nameToDial,
        dialDigitsByLengthDesc: [...dialDigits].sort((a, b) => b.length - a.length),
    };

    return cachedMaps;
}

function resolveByCountryIdentity(trimmedValue: string, maps: PhoneCountryCodeMaps): string | null {
    const isoCandidate = trimmedValue.toUpperCase();
    if (/^[A-Z]{2}$/.test(isoCandidate)) {
        return maps.isoToDial.get(isoCandidate) || null;
    }

    const token = normalizeToken(trimmedValue);
    if (!token) return null;

    const aliasIso = COUNTRY_NAME_ALIASES[token];
    if (aliasIso) {
        return maps.isoToDial.get(aliasIso) || null;
    }

    return maps.nameToDial.get(token) || null;
}

function resolveByNumericContent(trimmedValue: string, maps: PhoneCountryCodeMaps): string | null {
    const hasNumericSignal = /\d/.test(trimmedValue) || trimmedValue.includes('+');
    if (!hasNumericSignal) return null;

    let digits = trimmedValue.replace(/\D+/g, '');
    if (!digits) return null;

    digits = digits.replace(/^00+/, '');
    if (!digits) return null;

    if (maps.dialDigitsByLengthDesc.includes(digits)) {
        return `+${digits}`;
    }

    const prefix = maps.dialDigitsByLengthDesc.find((dialDigits) => digits.startsWith(dialDigits));
    if (prefix) {
        return `+${prefix}`;
    }

    if (digits.length <= 4) {
        return `+${digits}`;
    }

    return null;
}

export function normalizePhoneCountryCodeDetailed(
    value: string | null | undefined,
): PhoneCountryCodeNormalizationResult {
    if (value === null || value === undefined) {
        return { value, changed: false, resolved: true, reason: 'empty' };
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return {
            value: '',
            changed: value !== '',
            resolved: true,
            reason: 'empty',
        };
    }

    const maps = getPhoneCountryCodeMaps();

    const fromCountryIdentity = resolveByCountryIdentity(trimmed, maps);
    if (fromCountryIdentity) {
        return {
            value: fromCountryIdentity,
            changed: fromCountryIdentity !== value,
            resolved: true,
            reason: 'country_identity',
        };
    }

    const fromNumeric = resolveByNumericContent(trimmed, maps);
    if (fromNumeric) {
        return {
            value: fromNumeric,
            changed: fromNumeric !== value,
            resolved: true,
            reason: 'numeric',
        };
    }

    return {
        value: trimmed,
        changed: trimmed !== value,
        resolved: false,
        reason: 'unresolved',
    };
}

export function normalizePhoneCountryCode(value: string | null | undefined): string | null | undefined {
    return normalizePhoneCountryCodeDetailed(value).value;
}
