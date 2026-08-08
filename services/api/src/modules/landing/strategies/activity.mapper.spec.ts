import {
  maskFullName,
  resolveCountry,
  mapStatusToActivityType,
  mapRowToActivityItem,
  ACTIVITY_SOURCE_STATUSES,
  ActivityRow,
} from './activity.mapper';

// Fixtures mirror production shape: name and nationality come from
// participant_applications.personal_data, and nationality is an ISO alpha-2 code, not a
// display name. A fixture of `nationality: 'Japan'` (a display name where a code belongs)
// is exactly the wrong assumption that let this bug reach production.
function buildRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    status: 'accepted',
    full_name: 'Yuki Tanaka',
    nationality: 'JP',
    program_name: 'AYIMUN',
    ...overrides,
  };
}

describe('maskFullName', () => {
  it('reduces a two-word name to first name and last initial', () => {
    expect(maskFullName('Yuki Tanaka')).toBe('Yuki T.');
  });

  it('uses the final word for the initial on three-word names', () => {
    expect(maskFullName('Maria Clara Santos')).toBe('Maria S.');
  });

  it('returns a legitimate single-word name unchanged', () => {
    expect(maskFullName('Sukarno')).toBe('Sukarno');
  });

  it('collapses irregular whitespace before masking', () => {
    expect(maskFullName('  Yuki   Tanaka  ')).toBe('Yuki T.');
  });

  it('takes a whole code point for the initial on non-Latin names', () => {
    expect(maskFullName('Yuki 田中')).toBe('Yuki 田.');
  });

  it('returns null for an empty or whitespace-only name', () => {
    expect(maskFullName('')).toBeNull();
    expect(maskFullName('   ')).toBeNull();
  });

  it('rejects a 1-character name as bad input rather than showing it', () => {
    expect(maskFullName('X')).toBeNull();
    expect(maskFullName('  X  ')).toBeNull();
  });
});

describe('resolveCountry', () => {
  it('resolves an ISO alpha-2 code to its full display name and uppercases the code', () => {
    expect(resolveCountry(buildRow({ nationality: 'id' }))).toEqual({
      country: 'Indonesia',
      countryCode: 'ID',
    });
  });

  it('resolves an already-uppercase code', () => {
    expect(resolveCountry(buildRow({ nationality: 'JP' }))).toEqual({
      country: 'Japan',
      countryCode: 'JP',
    });
  });

  it('returns null when nationality is empty', () => {
    expect(resolveCountry(buildRow({ nationality: '' }))).toBeNull();
    expect(resolveCountry(buildRow({ nationality: null }))).toBeNull();
  });

  it('returns null for an unrecognised country value instead of emitting the raw code as a name', () => {
    expect(resolveCountry(buildRow({ nationality: 'ZZ' }))).toBeNull();
    expect(resolveCountry(buildRow({ nationality: 'not-a-code' }))).toBeNull();
  });
});

describe('mapStatusToActivityType', () => {
  it('maps accepted to the accepted type', () => {
    expect(mapStatusToActivityType('accepted')).toBe('accepted');
  });

  it.each(['submitted', 'under_review', 'interview_scheduled', 'waitlisted'])(
    'maps %s to the registered type',
    (status) => {
      expect(mapStatusToActivityType(status)).toBe('registered');
    },
  );

  it.each(['draft', 'rejected', 'withdrawn'])('excludes %s', (status) => {
    expect(mapStatusToActivityType(status)).toBeNull();
  });

  it('never lists an excluded status as a source status', () => {
    expect(ACTIVITY_SOURCE_STATUSES).not.toContain('draft');
    expect(ACTIVITY_SOURCE_STATUSES).not.toContain('rejected');
    expect(ACTIVITY_SOURCE_STATUSES).not.toContain('withdrawn');
  });
});

describe('mapRowToActivityItem', () => {
  it('builds an item with a resolved country name and code', () => {
    const item = mapRowToActivityItem(buildRow());
    expect(item).toEqual({
      type: 'accepted',
      name: 'Yuki T.',
      country: 'Japan',
      countryCode: 'JP',
      programName: 'AYIMUN',
    });
    expect(Object.keys(item as object).sort()).toEqual(
      ['country', 'countryCode', 'name', 'programName', 'type'].sort(),
    );
  });

  it('accepts a legitimate single-word name', () => {
    const item = mapRowToActivityItem(buildRow({ full_name: 'Sukarno' }));
    expect(item?.name).toBe('Sukarno');
  });

  it('drops a row with a blank name', () => {
    expect(mapRowToActivityItem(buildRow({ full_name: '' }))).toBeNull();
  });

  it('drops a row with a 1-character name', () => {
    expect(mapRowToActivityItem(buildRow({ full_name: 'X' }))).toBeNull();
  });

  it('drops a row with no nationality', () => {
    expect(mapRowToActivityItem(buildRow({ nationality: null }))).toBeNull();
  });

  it('drops a row with an unrecognised nationality value', () => {
    expect(mapRowToActivityItem(buildRow({ nationality: 'ZZ' }))).toBeNull();
  });

  it('drops a row with an excluded status', () => {
    expect(mapRowToActivityItem(buildRow({ status: 'rejected' }))).toBeNull();
  });
});
