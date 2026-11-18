// services/api/src/modules/landing/strategies/announcement-search.util.ts
import { Prisma } from '@prisma/client';

const MAX_SEARCH_TERMS = 8;
const MAX_TERM_LENGTH = 50;
// "JYS", "KYS", "MEYS", "WYF" — initials of 2-5 word brand names.
const ABBREVIATION_PATTERN = /^[a-z]{2,5}$/i;

export interface BrandRef {
  id: string;
  name: string;
}

/** Whitespace-split, de-duplicated, capped. Each term is matched independently (AND). */
export function tokenizeSearch(raw: string | undefined | null): string[] {
  const seen = new Set<string>();
  for (const part of (raw ?? '').split(/\s+/)) {
    const term = part.slice(0, MAX_TERM_LENGTH);
    if (term) seen.add(term.toLowerCase());
    if (seen.size >= MAX_SEARCH_TERMS) break;
  }
  return [...seen];
}

export function looksLikeAbbreviation(term: string): boolean {
  return ABBREVIATION_PATTERN.test(term);
}

/** "Middle East Youth Summit" -> "MEYS". Derived, so new brands need no list entry. */
export function brandInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .filter((char) => /[a-z]/i.test(char))
    .join('')
    .toUpperCase();
}

export function brandIdsForAbbreviation(term: string, brands: BrandRef[]): string[] {
  if (!looksLikeAbbreviation(term)) return [];
  const upper = term.toUpperCase();
  return brands.filter((brand) => brandInitials(brand.name) === upper).map((brand) => brand.id);
}

/**
 * One AND clause per term; each term may hit title, body, category, the program
 * name, or (when it is a brand abbreviation like JYS) any program of that brand.
 */
export function buildProgramSearchClauses(
  terms: string[],
  brands: BrandRef[],
): Prisma.ProgramAnnouncementWhereInput[] {
  return terms.map((term) => {
    const contains = { contains: term, mode: Prisma.QueryMode.insensitive };
    const brandIds = brandIdsForAbbreviation(term, brands);
    return {
      OR: [
        { title: contains },
        { content: contains },
        { category: contains },
        { program: { name: contains } },
        ...(brandIds.length ? [{ program: { brandId: { in: brandIds } } }] : []),
      ],
    };
  });
}

/** System announcements have no program, so a brand abbreviation maps to brandId. */
export function buildSystemSearchClauses(
  terms: string[],
  brands: BrandRef[],
): Prisma.SystemAnnouncementWhereInput[] {
  return terms.map((term) => {
    const contains = { contains: term, mode: Prisma.QueryMode.insensitive };
    const brandIds = brandIdsForAbbreviation(term, brands);
    return {
      OR: [
        { title: contains },
        { content: contains },
        ...(brandIds.length ? [{ brandId: { in: brandIds } }] : []),
      ],
    };
  });
}
