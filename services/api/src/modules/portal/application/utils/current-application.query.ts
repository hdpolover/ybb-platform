import { Prisma } from '@prisma/client';

/**
 * How the portal resolves "the participant's current application".
 *
 * A participant may hold one application per program (`@@unique([participantId,
 * programId])`), so any query that matches on `participantId` alone can match
 * several rows. Several portal handlers did exactly that with a bare
 * `findFirst` and no ordering, leaving the choice to whatever order Postgres
 * happened to return - which is why a multi-program participant could see
 * another program's payments or documents.
 *
 * The rule, in one place so the sites cannot drift apart again:
 *
 * - Scope to `programId` when the caller supplied one. The portal sends it
 *   whenever it knows which program is on screen; this is the only branch that
 *   is correct by construction rather than by heuristic.
 * - Never return a soft-deleted application.
 * - Prefer a live application over a withdrawn one, but do not hide a withdrawn
 *   one. Ordering withdrawn rows last rather than filtering them out means a
 *   participant whose only application is withdrawn still sees it, while a
 *   participant with both always gets the live one.
 * - Among live applications, prefer one the participant actually SUBMITTED
 *   (`submittedAt desc nulls last`). A brand running two editions at once
 *   leaves a participant holding a submitted/accepted application on one and
 *   an untouched draft on the other; the draft is the one webhooks and logins
 *   happen to have touched most recently, so recency alone landed MEYS 2026
 *   participants on an empty 2027 draft with no invitation letter. Mirrors
 *   the engagement ranking in ybb-program-next's resolveActiveProgramId, so a
 *   request that carries no programId resolves the same application the
 *   dashboard would have picked.
 * - Break the remaining tie on `updatedAt desc`.
 *
 * `updatedAt` is deliberately the LAST key, not the first. It is `@updatedAt`,
 * so payment reconciliation, webhook consumers and admin edits all bump it -
 * it means "most recently touched by anything", not "the one the participant
 * cares about". Ordering on it alone would let an unrelated cron job decide
 * which program a participant is looking at.
 *
 * NOT for the LOA download path. That one must not guess at all: it gates on
 * eligibility AFTER selection, so picking a plausible-but-ineligible
 * application turns into a silent "Invitation Letter not available" for a
 * participant who is genuinely eligible on another row. See LoaDownloadService.
 */
export const currentApplicationWhere = (
  participantId: string,
  programId?: string,
): Prisma.ParticipantApplicationWhereInput => ({
  participantId,
  deletedAt: null,
  ...(programId ? { programId } : {}),
});

export const currentApplicationOrderBy: Prisma.ParticipantApplicationOrderByWithRelationInput[] = [
  { withdrawnAt: { sort: 'asc', nulls: 'first' } },
  { submittedAt: { sort: 'desc', nulls: 'last' } },
  { updatedAt: 'desc' },
];
