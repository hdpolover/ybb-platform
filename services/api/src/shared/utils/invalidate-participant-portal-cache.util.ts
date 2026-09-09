// src/shared/utils/invalidate-participant-portal-cache.util.ts
import { Logger } from '@nestjs/common';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

type ParticipantLookup = {
  participant: {
    findUnique: (args: {
      where: { id: string };
      select: { userId: true };
    }) => Promise<{ userId: string } | null>;
  };
};

const logger = new Logger('InvalidateParticipantPortalCache');

/**
 * Busts the portal cache for the PARTICIPANT who owns an application, not the
 * admin acting on it.
 *
 * Several admin-only application mutations (create/update/submit/withdraw/
 * payment-intent) relied on the `@CacheInvalidate(['portal:*:${userId}'])`
 * decorator on the controller route. That decorator's `${userId}` is always
 * resolved from the authenticated JWT principal (see
 * cache-invalidation.interceptor.ts), which on an admin-only route is the
 * ADMIN's own id, never the participant's — so the pattern it built never
 * matched a real key and the participant's portal stayed stale for the full
 * TTL after an admin mutation. This helper does the lookup the decorator
 * could never do (resolving Participant.userId from participantId) and
 * invalidates the real key.
 *
 * `fallbackUserId` lets a caller skip the lookup when it already has the
 * participant's users.id on hand (e.g. resolved earlier in the same handler
 * for an unrelated reason).
 *
 * Never throws: cache invalidation failures must not roll back or fail the
 * mutation that already committed.
 */
export async function invalidateParticipantPortalCache(
  prisma: ParticipantLookup,
  cacheService: CacheService,
  participantId: string,
  fallbackUserId?: string,
): Promise<void> {
  try {
    let userId = fallbackUserId;
    if (!userId) {
      const participant = await prisma.participant.findUnique({
        where: { id: participantId },
        select: { userId: true },
      });
      userId = participant?.userId;
    }

    if (!userId) return;

    await Promise.all([
      cacheService.invalidatePortalCache(userId),
      cacheService.invalidateKeys([
        CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId),
        CACHE_KEYS.PARTICIPANT_STATS(participantId),
      ]),
    ]);
  } catch (error) {
    logger.error(
      `Failed to invalidate portal cache for participant ${participantId}:`,
      error instanceof Error ? error.stack : String(error),
    );
  }
}
