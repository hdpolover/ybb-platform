import { prisma, log, error } from './internal/prisma-config';

export { prisma, log, error };

/**
 * Hyphenated URL slug, same transform as src/shared/utils/url-slug.ts
 * toUrlSlug (copied rather than imported: tsconfig.seed.json's rootDir is
 * prisma/seeds, so seeds cannot import from src/).
 */
export function toUrlSlug(input: string, maxLength = 200): string {
  return (input ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * program_announcements.slug is globally unique. Prefixing with the program
 * slug keeps seeded titles like "Registration Open" from colliding across
 * brands, and keeps the slug stable across re-seeds.
 */
export function seedAnnouncementSlug(programSlug: string, title: string): string {
  return toUrlSlug(`${programSlug} ${title}`);
}

/**
 * Only runs `seed` if there are currently zero matching records.
 * Prevents re-seeding data that already exists (e.g. user-configured content).
 */
export async function seedOnce(
  label: string,
  count: () => Promise<number>,
  seed: () => Promise<void>,
): Promise<void> {
  const n = await count();
  if (n === 0) {
    await seed();
    log(`  ✓ Seeded ${label}`);
  } else {
    log(`  → ${label} already seeded (${n} record(s)), skipping`);
  }
}
