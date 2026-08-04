// services/api/src/shared/utils/birthdate-resolution.ts

// The application form stores the participant's date of birth in the
// personal_data JSON (key differs per form generation: 'birthdate' or
// 'date_of_birth'). Onboarding only ever asks for a birth year, so
// participants.birthdate is stored as Jan 1 of that year unless it was
// backfilled from personal_data (prod backfill 2026-08-04: 3,017/13,584
// rows now hold a real recovered date; the remaining 10,567 are still the
// Jan-1 placeholder). isYearOnlyBirthdate() below is what tells the two
// apart, so the fallback stays safe to use.
export function extractBirthdateFromPersonalData(personalData: unknown): string {
    if (!personalData || typeof personalData !== 'object') return '';
    const pd = personalData as Record<string, unknown>;
    const raw = pd.birthdate ?? pd.date_of_birth;
    return typeof raw === 'string' ? raw : '';
}

// True when a date value is exactly Jan 1, i.e. it carries no real day/month
// information (the onboarding year-only placeholder pattern).
export function isYearOnlyBirthdate(value: Date | string | number): boolean {
    // Cached records can arrive JSON-serialized, so the value may be an ISO
    // string rather than a Date.
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.getUTCMonth() === 0 && date.getUTCDate() === 1;
}

// Resolves the best-known birthdate for an application: prefer the value the
// participant entered on the application form (personal_data.birthdate /
// date_of_birth), falling back to the participant record only when it holds
// something other than the onboarding year-only placeholder.
export function resolveApplicationBirthdate(
    personalData: unknown,
    participantBirthdate: Date | string | null | undefined,
): Date | null {
    const raw = extractBirthdateFromPersonalData(personalData);
    if (raw) {
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (participantBirthdate && !isYearOnlyBirthdate(participantBirthdate)) {
        const fallback = participantBirthdate instanceof Date ? participantBirthdate : new Date(participantBirthdate);
        if (!Number.isNaN(fallback.getTime())) return fallback;
    }

    return null;
}
