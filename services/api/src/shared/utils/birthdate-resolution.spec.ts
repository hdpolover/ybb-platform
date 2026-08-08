// services/api/src/shared/utils/birthdate-resolution.spec.ts

import {
    extractBirthdateFromPersonalData,
    isYearOnlyBirthdate,
    resolveApplicationBirthdate,
} from './birthdate-resolution';

describe('extractBirthdateFromPersonalData', () => {
    it('returns the birthdate key when present', () => {
        expect(extractBirthdateFromPersonalData({ birthdate: '1998-05-12' })).toBe('1998-05-12');
    });

    it('returns the date_of_birth key when birthdate is absent', () => {
        expect(extractBirthdateFromPersonalData({ date_of_birth: '2000-11-03' })).toBe('2000-11-03');
    });

    it('prefers birthdate over date_of_birth when both are present', () => {
        expect(
            extractBirthdateFromPersonalData({ birthdate: '1998-05-12', date_of_birth: '2000-11-03' }),
        ).toBe('1998-05-12');
    });

    it('returns empty string when personalData is null', () => {
        expect(extractBirthdateFromPersonalData(null)).toBe('');
    });

    it('returns empty string when personalData is not an object', () => {
        expect(extractBirthdateFromPersonalData('not-an-object')).toBe('');
    });

    it('returns empty string when neither key is present', () => {
        expect(extractBirthdateFromPersonalData({ full_name: 'John Doe' })).toBe('');
    });

    it('returns empty string when the value is not a string', () => {
        expect(extractBirthdateFromPersonalData({ birthdate: 12345 })).toBe('');
    });
});

describe('isYearOnlyBirthdate', () => {
    it('returns true for a Jan 1 Date', () => {
        expect(isYearOnlyBirthdate(new Date('1998-01-01T00:00:00.000Z'))).toBe(true);
    });

    it('returns true for a Jan 1 ISO string (cached/serialized participant)', () => {
        expect(isYearOnlyBirthdate('1998-01-01T00:00:00.000Z')).toBe(true);
    });

    it('returns false for a real, non-Jan-1 date', () => {
        expect(isYearOnlyBirthdate(new Date('1998-05-12T00:00:00.000Z'))).toBe(false);
    });

    it('returns false for an unparseable value', () => {
        expect(isYearOnlyBirthdate('not-a-date')).toBe(false);
    });
});

describe('resolveApplicationBirthdate', () => {
    it('prefers a real personal_data birthdate over the participant column', () => {
        const result = resolveApplicationBirthdate(
            { birthdate: '1998-05-12' },
            new Date('1990-01-01T00:00:00.000Z'),
        );
        expect(result?.toISOString().slice(0, 10)).toBe('1998-05-12');
    });

    it('falls back to participant.birthdate when it holds a real (non-Jan-1) date', () => {
        const result = resolveApplicationBirthdate(null, new Date('1995-07-20T00:00:00.000Z'));
        expect(result?.toISOString().slice(0, 10)).toBe('1995-07-20');
    });

    it('returns null when personal_data has nothing and participant.birthdate is the year-only placeholder', () => {
        const result = resolveApplicationBirthdate(null, new Date('1990-01-01T00:00:00.000Z'));
        expect(result).toBeNull();
    });

    it('returns null when both personal_data and participant.birthdate are absent', () => {
        expect(resolveApplicationBirthdate(null, null)).toBeNull();
        expect(resolveApplicationBirthdate({}, undefined)).toBeNull();
    });

    it('falls back to participant.birthdate when personal_data has an unparseable birthdate string', () => {
        const result = resolveApplicationBirthdate(
            { birthdate: 'not-a-real-date' },
            new Date('1995-07-20T00:00:00.000Z'),
        );
        expect(result?.toISOString().slice(0, 10)).toBe('1995-07-20');
    });

    it('reads date_of_birth when birthdate key is absent from personal_data', () => {
        const result = resolveApplicationBirthdate(
            { date_of_birth: '2001-03-15' },
            new Date('1990-01-01T00:00:00.000Z'),
        );
        expect(result?.toISOString().slice(0, 10)).toBe('2001-03-15');
    });

    // The Jan-1 placeholder check only applies to the participants.birthdate
    // fallback (onboarding only collects a year, so it stamps day/month as
    // Jan 1). A Jan-1 value the applicant typed into personal_data is a
    // genuine answer, not the placeholder pattern, and must be trusted as-is.
    it('does not treat a genuine Jan-1 personal_data birthdate as the placeholder', () => {
        const result = resolveApplicationBirthdate(
            { birthdate: '1990-01-01' },
            new Date('1990-01-01T00:00:00.000Z'), // also happens to be the placeholder value, irrelevant here
        );
        expect(result?.toISOString().slice(0, 10)).toBe('1990-01-01');
    });
});
