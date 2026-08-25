// src/shared/utils/active-participant.filter.ts
import { Prisma } from '@prisma/client';

/**
 * Deactivated/soft-deleted accounts must stay visible in admin detail and
 * list views (so admins can still see "this person once paid"), but must
 * never appear in an export or receive an automated email. This is the one
 * shared predicate for that second case - spread/assign it into any
 * ParticipantApplication `where` used to build an export or an automated
 * notification recipient list. Do NOT use it to filter admin browse/detail
 * queries or anything that changes financial/record state (e.g. payment
 * reconciliation) - those must keep operating on deactivated accounts too.
 */
export const ACTIVE_PARTICIPANT_WHERE = {
  deletedAt: null,
  user: { isActive: true, deletedAt: null },
} satisfies Prisma.ParticipantApplicationWhereInput['participant'];

/**
 * Post-fetch equivalent for call sites that already selected
 * participant/user fields for other reasons (e.g. payment reconciliation,
 * which must still reconcile a deactivated user's invoice - only the
 * reminder email it sends is gated by this check).
 */
export function isActiveParticipant(participant: {
  deletedAt: Date | null;
  user: { isActive: boolean; deletedAt: Date | null };
} | null | undefined): boolean {
  if (!participant) return false;
  return participant.deletedAt === null && participant.user.isActive && participant.user.deletedAt === null;
}
