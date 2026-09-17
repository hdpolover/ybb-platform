import { isUuid, resolveUniqueSlug, toUrlSlug, URL_SLUG_MAX_LENGTH, URL_SLUG_PATTERN } from './url-slug';

const fallback = () => 'announcement-abcd1234';

describe('toUrlSlug', () => {
  it('produces the hyphenated form the client asked for', () => {
    expect(toUrlSlug('Kwon Hae-suk Explores AI for Inclusive Global Communities')).toBe(
      'kwon-hae-suk-explores-ai-for-inclusive-global-communities',
    );
  });

  it('collapses punctuation and whitespace runs into one hyphen and trims the ends', () => {
    expect(toUrlSlug('  --Hello,   World!!  (2026) -- ')).toBe('hello-world-2026');
  });

  it('folds accented Latin letters to their base letter', () => {
    expect(toUrlSlug('Café Niño Müller Ørsted')).toBe('cafe-nino-muller-rsted');
  });

  it('drops scripts with no ASCII decomposition, leaving "" for the caller to replace', () => {
    expect(toUrlSlug('한국 청년 서밋')).toBe('');
    expect(toUrlSlug('Korea 청년 Summit')).toBe('korea-summit');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = toUrlSlug(`${'a'.repeat(URL_SLUG_MAX_LENGTH - 1)} bcd`);
    expect(slug).toBe('a'.repeat(URL_SLUG_MAX_LENGTH - 1));
    expect(slug.length).toBeLessThanOrEqual(URL_SLUG_MAX_LENGTH);
    expect(URL_SLUG_PATTERN.test(slug)).toBe(true);
  });

  it('always matches URL_SLUG_PATTERN when non-empty', () => {
    for (const input of ['A', 'x--y', '__a__b__', 'ÀÉÎ õü', '1 2 3']) {
      const slug = toUrlSlug(input);
      expect(URL_SLUG_PATTERN.test(slug)).toBe(true);
    }
  });
});

describe('isUuid', () => {
  it('recognises canonical UUIDs in either case', () => {
    expect(isUuid('20069fca-e516-429f-a3bc-e88d80ce2021')).toBe(true);
    expect(isUuid('20069FCA-E516-429F-A3BC-E88D80CE2021')).toBe(true);
  });

  it('rejects slugs', () => {
    expect(isUuid('kwon-hae-suk-explores-ai')).toBe(false);
    expect(isUuid('20069fca-e516-429f-a3bc-e88d80ce2021-2')).toBe(false);
  });
});

describe('resolveUniqueSlug', () => {
  const takenSet = (...slugs: string[]) => {
    const set = new Set(slugs);
    return jest.fn(async (slug: string) => set.has(slug));
  };

  it('returns the base slug when it is free', async () => {
    const exists = takenSet();
    await expect(resolveUniqueSlug('Big News', exists, { fallback })).resolves.toBe('big-news');
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it('appends -2, -3 ... until a free slug is found', async () => {
    const exists = takenSet('big-news', 'big-news-2');
    await expect(resolveUniqueSlug('Big News', exists, { fallback })).resolves.toBe('big-news-3');
  });

  it('uses the fallback when the base slugifies to nothing', async () => {
    await expect(resolveUniqueSlug('한국 청년', takenSet(), { fallback })).resolves.toBe('announcement-abcd1234');
  });

  it('shortens the base so the suffix stays within maxLength', async () => {
    const base = 'b'.repeat(20);
    const slug = await resolveUniqueSlug(base, takenSet(base), { fallback, maxLength: 20 });
    expect(slug).toBe(`${'b'.repeat(18)}-2`);
    expect(slug.length).toBe(20);
  });

  it('never returns a UUID-shaped slug, because public lookup would read it as an id', async () => {
    const slug = await resolveUniqueSlug('20069fca-e516-429f-a3bc-e88d80ce2021', takenSet(), { fallback });
    expect(isUuid(slug)).toBe(false);
    expect(slug).toBe('20069fca-e516-429f-a3bc-e88d80ce2021-2');
  });

  it('falls back to a random suffix after the sequential range is exhausted', async () => {
    const exists = jest.fn(async (slug: string) => slug === 'x' || /^x-\d+$/.test(slug));
    const slug = await resolveUniqueSlug('x', exists, { fallback });
    expect(slug).toMatch(/^x-[a-z0-9]{6}$/);
    expect(URL_SLUG_PATTERN.test(slug)).toBe(true);
  });

  it('gives up with an error instead of looping forever', async () => {
    await expect(resolveUniqueSlug('x', async () => true, { fallback })).rejects.toThrow(/free slug/);
  });
});
