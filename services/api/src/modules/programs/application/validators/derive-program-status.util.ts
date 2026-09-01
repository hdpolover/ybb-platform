// file: services/api/src/modules/programs/application/validators/derive-program-status.util.ts

/**
 * Keeps Program.status in sync with isPublished/isActive when an admin
 * flips either flag true without touching status themselves.
 *
 * Program carries `status` (draft/published/ongoing/completed/cancelled)
 * alongside the separate `isPublished`/`isActive` booleans, and every public
 * query gates on all three together (`isPublished && isActive && status !==
 * 'draft'`, see shared/utils/active-program-resolver.ts). The admin has two
 * different edit surfaces that write isPublished — the platform Programs
 * list modal (which always sends status alongside it) and the per-program
 * "Program Specifics" drawer (which only ever sends isPublished, never
 * status). A program saved through the latter with isPublished/isActive
 * flipped true kept status='draft' from creation, so it looked live in the
 * admin (published + active) while every public query still excluded it —
 * "Middle East Youth Summit 7th" sat like this undetected until a prod DB
 * query found it (2026-09-01 incident).
 *
 * This does NOT replace the public query guard (status !== 'draft' stays
 * the source of truth there) — it prevents the admin write path from
 * leaving status behind in the first place.
 */
export function deriveProgramStatus(
  currentStatus: string,
  incoming: { status?: string; isPublished?: boolean; isActive?: boolean },
): string | undefined {
  // An explicit status in the same request is the admin's stated intent —
  // never override it, even if it disagrees with isPublished/isActive. A
  // program can be legitimately unpublished while still marked 'completed'
  // or 'cancelled', for instance.
  if (incoming.status !== undefined) {
    return undefined;
  }

  // Only 'draft' ever advances automatically. A program already 'ongoing',
  // 'completed', or 'cancelled' must not be dragged back to 'published'
  // just because an admin re-saved isPublished/isActive as true.
  if (currentStatus !== 'draft') {
    return undefined;
  }

  if (incoming.isPublished === true || incoming.isActive === true) {
    return 'published';
  }

  return undefined;
}
