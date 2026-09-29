// src/modules/applications/infrastructure/persistence/application-search.filter.ts
import { Prisma } from '@prisma/client';

/**
 * OR-clauses for the admin applications free-text search.
 *
 * The participant name and user email conditions MUST share one `participant`
 * relation filter. Two sibling `participant` filters make Prisma LEFT JOIN
 * `participants` twice; the planner then builds two parallel hash tables over
 * ~285k rows, and the Postgres container's default 64MB /dev/shm overflows
 * under concurrent searches ("could not resize shared memory segment ... No
 * space left on device" -> HTTP 500).
 */
export function buildApplicationSearchFilter(
  search: string,
): Prisma.ParticipantApplicationWhereInput[] {
  const match = { contains: search, mode: 'insensitive' } as const;
  return [
    { motivationLetter: match },
    { achievements: match },
    { experiences: match },
    { participant: { OR: [{ fullName: match }, { user: { email: match } }] } },
  ];
}
