import { Country } from 'country-state-city';

const COUNTRY_NAME_ALIASES: Record<string, string> = {
    turkiye: 'TR',
    usa: 'US',
    unitedstatesofamerica: 'US',
    uk: 'GB',
    uae: 'AE',
};

type CountryMaps = {
    isoToName: Map<string, string>;
    nameToName: Map<string, string>;
};

let cachedMaps: CountryMaps | null = null;

function normalizeToken(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function getCountryMaps(): CountryMaps {
    if (cachedMaps) return cachedMaps;

    const isoToName = new Map<string, string>();
    const nameToName = new Map<string, string>();

    for (const country of Country.getAllCountries()) {
        const iso = (country.isoCode || '').toUpperCase();
        const name = (country.name || '').trim();
        const nameKey = normalizeToken(name);

        if (!iso || !name) continue;

        isoToName.set(iso, name);
        if (nameKey && !nameToName.has(nameKey)) {
            nameToName.set(nameKey, name);
        }
    }

    for (const [alias, iso] of Object.entries(COUNTRY_NAME_ALIASES)) {
        const name = isoToName.get(iso);
        if (name) {
            nameToName.set(alias, name);
        }
    }

    cachedMaps = { isoToName, nameToName };
    return cachedMaps;
}

export function getCountryDisplayName(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const maps = getCountryMaps();
    const isoCandidate = trimmed.toUpperCase();

    if (/^[A-Z]{2}$/.test(isoCandidate)) {
        return maps.isoToName.get(isoCandidate) ?? null;
    }

    const name = maps.nameToName.get(normalizeToken(trimmed));
    return name ?? null;
}
