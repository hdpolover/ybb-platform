// src/shared/utils/invalidate-participant-portal-cache.spec.ts
import { invalidateParticipantPortalCache } from './invalidate-participant-portal-cache.util';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

describe('invalidateParticipantPortalCache', () => {
  const participantId = 'participant-1';
  const participantUserId = 'participant-user-1';

  function buildCacheServiceMock() {
    return {
      invalidatePortalCache: jest.fn().mockResolvedValue(undefined),
      invalidateKeys: jest.fn().mockResolvedValue(undefined),
    } as any;
  }

  it("invalidates the PARTICIPANT's portal cache key, not an admin's", async () => {
    // This is the whole M103/M120 bug: the broken @CacheInvalidate decorator
    // resolved userId from the acting ADMIN's JWT. Prove the fix invalidates
    // the owning participant's key instead.
    const prisma = {
      participant: {
        findUnique: jest.fn().mockResolvedValue({ userId: participantUserId }),
      },
    };
    const cacheService = buildCacheServiceMock();
    const adminUserId = 'admin-user-999';

    await invalidateParticipantPortalCache(prisma, cacheService, participantId);

    expect(prisma.participant.findUnique).toHaveBeenCalledWith({
      where: { id: participantId },
      select: { userId: true },
    });
    expect(cacheService.invalidatePortalCache).toHaveBeenCalledWith(participantUserId);
    expect(cacheService.invalidatePortalCache).not.toHaveBeenCalledWith(adminUserId);
    expect(cacheService.invalidateKeys).toHaveBeenCalledWith([
      CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId),
      CACHE_KEYS.PARTICIPANT_STATS(participantId),
    ]);
  });

  it('uses fallbackUserId without hitting the database when provided', async () => {
    const prisma = {
      participant: { findUnique: jest.fn() },
    };
    const cacheService = buildCacheServiceMock();

    await invalidateParticipantPortalCache(prisma, cacheService, participantId, participantUserId);

    expect(prisma.participant.findUnique).not.toHaveBeenCalled();
    expect(cacheService.invalidatePortalCache).toHaveBeenCalledWith(participantUserId);
  });

  it('does nothing when the participant has no resolvable userId', async () => {
    const prisma = {
      participant: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const cacheService = buildCacheServiceMock();

    await invalidateParticipantPortalCache(prisma, cacheService, participantId);

    expect(cacheService.invalidatePortalCache).not.toHaveBeenCalled();
    expect(cacheService.invalidateKeys).not.toHaveBeenCalled();
  });

  it('swallows errors instead of throwing, so cache failures never fail the mutation', async () => {
    const prisma = {
      participant: {
        findUnique: jest.fn().mockRejectedValue(new Error('redis is down')),
      },
    };
    const cacheService = buildCacheServiceMock();

    await expect(
      invalidateParticipantPortalCache(prisma, cacheService, participantId),
    ).resolves.toBeUndefined();
  });
});
