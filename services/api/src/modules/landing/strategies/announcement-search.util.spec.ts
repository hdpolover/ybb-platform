// services/api/src/modules/landing/strategies/announcement-search.util.spec.ts
import {
  brandIdsForAbbreviation,
  brandInitials,
  buildProgramSearchClauses,
  tokenizeSearch,
} from './announcement-search.util';

const BRANDS = [
  { id: 'jys', name: 'Japan Youth Summit' },
  { id: 'kys', name: 'Korea Youth Summit' },
  { id: 'meys', name: 'Middle East Youth Summit' },
  { id: 'wyf', name: 'World Youth Fest' },
  { id: 'yaf', name: 'Youth Academic Forum' },
];

describe('tokenizeSearch', () => {
  it('splits on any whitespace, lowercases and de-duplicates', () => {
    expect(tokenizeSearch('  Winner  JYS\t2026 winner ')).toEqual(['winner', 'jys', '2026']);
  });

  it('returns no terms for blank input', () => {
    expect(tokenizeSearch('   ')).toEqual([]);
    expect(tokenizeSearch(undefined)).toEqual([]);
  });

  it('caps the term count and term length', () => {
    expect(tokenizeSearch('a b c d e f g h i j')).toHaveLength(8);
    expect(tokenizeSearch('x'.repeat(200))[0]).toHaveLength(50);
  });
});

describe('brandInitials / brandIdsForAbbreviation', () => {
  it('derives initials from the brand name', () => {
    expect(BRANDS.map((b) => brandInitials(b.name))).toEqual(['JYS', 'KYS', 'MEYS', 'WYF', 'YAF']);
  });

  it('matches abbreviations case-insensitively', () => {
    expect(brandIdsForAbbreviation('jys', BRANDS)).toEqual(['jys']);
    expect(brandIdsForAbbreviation('MEYS', BRANDS)).toEqual(['meys']);
  });

  it('ignores non-abbreviation terms and unknown abbreviations', () => {
    expect(brandIdsForAbbreviation('winner', BRANDS)).toEqual([]);
    expect(brandIdsForAbbreviation('2026', BRANDS)).toEqual([]);
    expect(brandIdsForAbbreviation('zzz', BRANDS)).toEqual([]);
  });
});

describe('buildProgramSearchClauses', () => {
  it('builds one independent clause per term, so word order and spread do not matter', () => {
    const clauses = buildProgramSearchClauses(['winner', 'jys', '2026'], BRANDS);
    expect(clauses).toHaveLength(3);
    // plain word: title/content/category/program name only
    expect((clauses[0].OR as unknown[]).length).toBe(4);
    // JYS additionally matches every program of the Japan brand
    expect(clauses[1].OR).toContainEqual({ program: { brandId: { in: ['jys'] } } });
    expect(clauses[2].OR).not.toContainEqual({ program: { brandId: expect.anything() } });
  });

  it('searches the program name so "Japan Youth Summit" matches by program', () => {
    const [clause] = buildProgramSearchClauses(['japan'], BRANDS);
    expect(clause.OR).toContainEqual({ program: { name: { contains: 'japan', mode: 'insensitive' } } });
  });
});
