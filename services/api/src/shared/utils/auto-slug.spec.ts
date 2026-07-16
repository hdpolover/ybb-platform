import { autoSlug, autoSlugWithCollisionSuffix } from './auto-slug';

describe('autoSlug', () => {
  it('lowercases and underscore-separates basic labels', () => {
    expect(autoSlug('T-Shirt Size')).toBe('tshirt_size');
    expect(autoSlug('Full Name')).toBe('full_name');
  });

  it('strips non-alphanumeric characters', () => {
    expect(autoSlug("Participant's Nickname!")).toBe('participants_nickname');
  });

  it('collapses whitespace and hyphens into single underscores', () => {
    expect(autoSlug('Foo   bar - baz')).toBe('foo_bar_baz');
  });

  it('prefixes a leading digit with f_', () => {
    expect(autoSlug('123 go')).toBe('f_123_go');
  });

  it('truncates to 64 chars', () => {
    const long = 'a'.repeat(200);
    expect(autoSlug(long).length).toBeLessThanOrEqual(64);
  });

  it('returns empty string for empty / whitespace-only input', () => {
    expect(autoSlug('')).toBe('');
    expect(autoSlug('   ')).toBe('');
  });

  it('handles non-ASCII by stripping accents', () => {
    expect(autoSlug('Niño Müller')).toBe('nino_muller');
  });
});

describe('autoSlugWithCollisionSuffix', () => {
  it('returns base slug when no collision', () => {
    expect(autoSlugWithCollisionSuffix('T-Shirt Size', new Set())).toBe('tshirt_size');
  });

  it('appends _2, _3, ... until unique', () => {
    const taken = new Set(['tshirt_size', 'tshirt_size_2']);
    expect(autoSlugWithCollisionSuffix('T-Shirt Size', taken)).toBe('tshirt_size_3');
  });
});
