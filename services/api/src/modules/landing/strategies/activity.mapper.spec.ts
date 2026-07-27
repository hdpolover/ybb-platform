import {
  maskFullName,
  resolveCountry,
  mapStatusToActivityType,
  mapRowToActivityItem,
  ACTIVITY_SOURCE_STATUSES,
  ActivityRow,
} from './activity.mapper';

function buildRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    status: 'accepted',
    full_name: 'Yuki Tanaka',
    nationality: 'Japan',
    nationality_code: 'jp',
    origin_country: null,
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

  it('returns a single-word name unchanged', () => {
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
});

describe('resolveCountry', () => {
  it('prefers nationality and upper-cases the code', () => {
    expect(resolveCountry(buildRow())).toEqual({ country: 'Japan', countryCode: 'JP' });
  });

  it('falls back to origin country when nationality is empty', () => {
    const row = buildRow({ nationality: '  ', origin_country: 'Indonesia', nationality_code: null });
    expect(resolveCountry(row)).toEqual({ country: 'Indonesia', countryCode: '' });
  });

  it('returns null when both country fields are empty', () => {
    expect(resolveCountry(buildRow({ nationality: null, origin_country: '' }))).toBeNull();
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
  it('builds an item with no identifying fields', () => {
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

  it('drops a row with a blank name', () => {
    expect(mapRowToActivityItem(buildRow({ full_name: '' }))).toBeNull();
  });

  it('drops a row with no country', () => {
    expect(mapRowToActivityItem(buildRow({ nationality: null, origin_country: null }))).toBeNull();
  });

  it('drops a row with an excluded status', () => {
    expect(mapRowToActivityItem(buildRow({ status: 'rejected' }))).toBeNull();
  });
});
