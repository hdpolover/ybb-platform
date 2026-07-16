import { sanitizePhone, extractAndSanitizePhone } from './phone-e164';

describe('sanitizePhone', () => {
  it('passes through an already-valid international number', () => {
    const result = sanitizePhone('+77012345678');
    expect(result).toEqual({ value: '+77012345678', isValid: true });
  });

  it('parses a national-format number using the region hint', () => {
    const result = sanitizePhone('03255252525', 'PK');
    expect(result.isValid).toBe(true);
    expect(result.value.startsWith('+92')).toBe(true);
  });

  it('keeps garbage input unchanged and marks it invalid', () => {
    const result = sanitizePhone('abc123');
    expect(result).toEqual({ value: 'abc123', isValid: false });
  });

  it('returns "-" and invalid for an empty string', () => {
    expect(sanitizePhone('')).toEqual({ value: '-', isValid: false });
  });

  it('returns "-" and invalid for undefined', () => {
    expect(sanitizePhone(undefined)).toEqual({ value: '-', isValid: false });
  });

  it('never fabricates a number when the region hint is missing/wrong', () => {
    // National-format number with no region hint at all — unparseable, must
    // fall back to the raw string rather than guessing a country.
    const result = sanitizePhone('03255252525');
    expect(result).toEqual({ value: '03255252525', isValid: false });
  });

  it('does not throw on a malformed/unsupported region hint', () => {
    expect(() => sanitizePhone('123', 'ZZ')).not.toThrow();
    const result = sanitizePhone('123', 'ZZ');
    expect(result.isValid).toBe(false);
    expect(result.value).toBe('123');
  });
});

describe('extractAndSanitizePhone', () => {
  it('extracts the single "phone" field and validates it', () => {
    const result = extractAndSanitizePhone({ phone: '+77012345678', nationality: 'KZ' });
    expect(result).toEqual({ value: '+77012345678', isValid: true });
  });

  it('uses nationality as the region hint for the split phone_number field', () => {
    const result = extractAndSanitizePhone({
      phone_number: '03255252525',
      nationality: 'PK',
    });
    expect(result.isValid).toBe(true);
    expect(result.value.startsWith('+92')).toBe(true);
  });

  it('returns "-" / invalid when personal_data has no phone at all', () => {
    expect(extractAndSanitizePhone({ nationality: 'PK' })).toEqual({
      value: '-',
      isValid: false,
    });
  });
});
