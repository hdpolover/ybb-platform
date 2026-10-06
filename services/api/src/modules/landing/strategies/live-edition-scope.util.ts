// services/api/src/modules/landing/strategies/live-edition-scope.util.ts
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

/**
 * Lifecycle statuses of an edition that is currently running. Completed,
 * cancelled and draft editions are history (or not public yet) and must not
 * feed "what is happening now" numbers on a brand's landing page.
 */
export const LIVE_PROGRAM_STATUSES = ['published', 'ongoing'] as const;

const DISTRIBUTION_SELECT = {
  participant: { select: { originCountry: true, nationality: true } },
} satisfies Prisma.ParticipantApplicationSelect;

export type DistributionApplication = Prisma.ParticipantApplicationGetPayload<{
  select: typeof DISTRIBUTION_SELECT;
}>;

function findDistributionApplications(
  prisma: PrismaService,
  program: Prisma.ProgramWhereInput,
): Promise<DistributionApplication[]> {
  return prisma.participantApplication.findMany({
    where: {
      // Every registered participant counts (any application status), not only
      // submitted ones. deletedAt:null still excludes removed rows.
      deletedAt: null,
      program,
      participant: { deletedAt: null },
    },
    select: DISTRIBUTION_SELECT,
  });
}

/**
 * Applications behind the public "Participant Distribution by Country" map.
 *
 * Scoped to the brand's live editions so a new edition shows its own numbers,
 * not the tens of thousands of applications of completed (and legacy-imported)
 * editions. A live edition with a single application shows that one.
 *
 * Only when the live editions have no applications at all does it fall back to
 * every published edition: a brand whose live edition still registers on the
 * legacy system has no rows here, and an empty map hides the section.
 *
 * Known cost of that fallback: zero rows cannot tell "registers elsewhere" from
 * "opened an hour ago", so a brand-new edition shows the all-edition total
 * until its first application arrives, then drops to its own count.
 */
export async function loadDistributionApplications(
  prisma: PrismaService,
  brandId: string,
): Promise<DistributionApplication[]> {
  const liveApplications = await findDistributionApplications(prisma, {
    brandId,
    isPublished: true,
    isActive: true,
    status: { in: [...LIVE_PROGRAM_STATUSES] },
    deletedAt: null,
  });
  if (liveApplications.length > 0) return liveApplications;

  return findDistributionApplications(prisma, { brandId, isPublished: true, deletedAt: null });
}
