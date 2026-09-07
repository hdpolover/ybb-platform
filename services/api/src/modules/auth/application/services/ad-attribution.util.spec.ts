import { Prisma } from '@prisma/client';
import { buildAdAttributionJson, parseAdAttribution } from './ad-attribution.util';

describe('buildAdAttributionJson', () => {
  it('returns undefined when nothing was captured (no column write, no empty object)', () => {
    expect(buildAdAttributionJson(undefined)).toBeUndefined();
    expect(buildAdAttributionJson({})).toBeUndefined();
  });

  it('keeps only the known keys and stamps capturedAt', () => {
    const result = buildAdAttributionJson({ fbp: 'fb.1.a', fbc: 'fb.1.b', ttp: 'tt.1', ttclid: 'tt-click' });
    expect(result).toEqual({
      fbp: 'fb.1.a',
      fbc: 'fb.1.b',
      ttp: 'tt.1',
      ttclid: 'tt-click',
      capturedAt: expect.any(String),
    });
  });

  it('drops a value over the 256-char cap defensively, even if the DTO already validated it', () => {
    const result = buildAdAttributionJson({ fbp: 'a'.repeat(257), fbc: 'valid' });
    expect(result).toEqual({ fbc: 'valid', capturedAt: expect.any(String) });
  });
});

describe('parseAdAttribution', () => {
  it('round-trips what buildAdAttributionJson wrote', () => {
    const written = buildAdAttributionJson({ fbp: 'fb.1.a', ttclid: 'tt-click' });
    expect(parseAdAttribution(written as Prisma.JsonValue)).toEqual({ fbp: 'fb.1.a', ttclid: 'tt-click' });
  });

  it('returns undefined for null/non-object/garbage input rather than throwing', () => {
    expect(parseAdAttribution(null)).toBeUndefined();
    expect(parseAdAttribution(undefined)).toBeUndefined();
    expect(parseAdAttribution('not-an-object' as any)).toBeUndefined();
    expect(parseAdAttribution([1, 2, 3] as any)).toBeUndefined();
    expect(parseAdAttribution({ unrelated: 'field' })).toBeUndefined();
  });
});
