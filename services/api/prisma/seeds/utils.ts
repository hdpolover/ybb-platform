import { prisma, log, error } from './internal/prisma-config';

export { prisma, log, error };

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
