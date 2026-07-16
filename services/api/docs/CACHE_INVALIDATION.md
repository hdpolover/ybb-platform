# Cache Invalidation Policy

## Strategy: invalidate where the context exists

Every mutation that changes data served by a cached endpoint MUST invalidate the cache keys that store that data. The codebase uses **two mechanisms**, applied based on which layer has the necessary context.

### Mechanism 1: `@CacheInvalidate` decorator (controller layer)

Use when:
- The endpoint mutates the requesting user's own data (self-service participant flows)
- The mutation affects landing-page data and wildcard scope is acceptable
- All required IDs are derivable from `req.params`, `req.body`, `req.query`, or `req.user.userId`

```ts
import { CacheInvalidate } from '@shared/decorators/cache-invalidate.decorator';
import { LANDING_BRAND_PATTERNS, PROGRAM_CONTENT_PATTERNS } from '@shared/constants/cache-patterns';

@Put(':id/settings')
@CacheInvalidate(LANDING_BRAND_PATTERNS)
async updateBrandSettings(@Param('id') id: string, @Body() dto: UpdateBrandSettingsDto) {
  return this.commandBus.execute(new UpdateBrandSettingsCommand(id, dto));
}
```

The decorator's interceptor (`shared/interceptors/cache-invalidation.interceptor.ts`) runs after the handler resolves and uses Redis Pub/Sub to broadcast invalidation to other API instances.

### Mechanism 2: Direct `cacheService` calls (handler / controller layer)

Use when:
- The admin is the requester but the affected user is someone else (decorator can't resolve participant userId from `req.user = admin`)
- Event handlers (no `req.user` available — webhooks, RabbitMQ events)
- DB lookups are needed for fan-out (e.g. resolving `program.brandId` from a `programId`)
- A specific HOUR-cached key (`PROGRAM_REQUIREMENTS`, `PROGRAM_RESOURCES`) needs targeted busting

```ts
// In a CQRS handler:
@CommandHandler(ReviewApplicationCommand)
export class ReviewApplicationHandler {
  constructor(
    private readonly applicationRepository: IApplicationRepository,
    private readonly cacheService: CacheService,
  ) {}

  async execute(cmd: ReviewApplicationCommand) {
    const updated = await this.applicationRepository.review(cmd);
    await this.invalidateParticipantCache(cmd.participantId);
    return updated;
  }

  private async invalidateParticipantCache(participantId: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: { userId: true },
    });
    if (!participant) return;
    await Promise.all([
      this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DASHBOARD(participant.userId)),
      this.cacheService.invalidateByPattern(`portal:submissions:${participant.userId}:*`),
      // ...
    ]);
  }
}
```

## Cache key shape — userId vs participantId

Portal cache keys are scoped by **userId** (auth identity), not participantId. Read handlers cache by `req.user.userId`, so writers must do the same.

| Key | Shape | Notes |
|-----|-------|-------|
| `portal:dashboard:${userId}` | single key | Match read |
| `portal:submissions:${userId}:${programId\|'latest'}` | per-program | Use wildcard pattern `portal:submissions:${userId}:*` to bust all variants |
| `portal:submission-detail:${userId}:${programId\|'latest'}` | per-program | Use wildcard pattern |
| `portal:payments:${userId}:${programId\|'latest'}` | per-program | Use wildcard pattern |
| `portal:payment-detail:${invoiceId}` | per-invoice | Specific bust on payment events |
| `portal:documents:${userId}` | single key | |
| `portal:certificates:${userId}` | single key | |
| `participant:profile:${userId}` | single key | userId-keyed |
| `participant:stats:${participantId}` | single key | participantId-keyed |
| `participant:latest-app:${participantId}` | single key | participantId-keyed |

**Common mistake:** invalidating `CACHE_KEYS.PORTAL_PAYMENTS(userId)` (which resolves to `portal:payments:${userId}:latest`) misses every program-specific cached entry. Always use the wildcard pattern `portal:payments:${userId}:*` when invalidating portal payments.

## Pattern presets (`@shared/constants/cache-patterns`)

- **`LANDING_BRAND_PATTERNS`** — landing pages only (8 patterns). Use for brand settings, sponsors, social feeds, legal docs, FAQs, system announcements, achievements.
- **`PROGRAM_CONTENT_PATTERNS`** — landing + portal views that read program data (14 patterns). Use for essays, requirements, resources, pricing tiers, validity periods, schedule, speakers, partners, gallery, testimonials, FAQs, document templates, program announcements, participation info, exchange rates.

## CacheService helpers

Defined in `shared/infrastructure/cache/cache.service.ts`:

- `invalidateKey(key)` — single key
- `invalidateKeys(keys[])` — batch single keys
- `invalidateByPattern(pattern)` — Redis SCAN + DEL (production-safe, not KEYS)
- `invalidateByPatterns(patterns[])` — batch wildcard patterns
- `invalidateBrandLandingCaches(brandId)` — busts every landing key for one brand precisely
- `invalidateInvoiceCache(invoiceId, userId)` — busts payment-detail + portal:payments:userId:* + portal:dashboard for one invoice/user

## TTLs (`CACHE_TTL` in `shared/constants/cache-keys.ts`)

- `SHORT` (1 min) — `PORTAL_PAYMENT_DETAIL`
- `MEDIUM` (5 min) — most portal keys
- `LONG` (15 min) — `PARTICIPANT_PROFILE`, `PARTICIPANT_STATS`, landing announcements
- `HOUR` (60 min) — landing pages, `PROGRAM_ESSAYS`, `PROGRAM_REQUIREMENTS`, `PROGRAM_RESOURCES`
- `DAY` (24 h) — reserved

A missed invalidation strands stale data for up to the TTL.

## Adding a new mutation

1. Identify which cache keys serve the data your mutation changes.
2. Pick the mechanism per the strategy above.
3. The regression test at `test/integration/cache-invalidation-coverage.spec.ts` will fail the build if your handler/controller skips invalidation. To opt out (rare), add the path to the test's allowlist with a one-line code comment justifying why no invalidation is needed.

## When NOT to invalidate

- Read-only queries
- Append-only audit logs (`audit/`)
- Auth login/refresh/logout — session and token caches handle themselves
- Notification read-status mutations
- Admin role assignments not surfaced on landing/portal
- AI bot config, support tickets, newsletter subscribe/unsubscribe, deletion requests — internal/outbound-only

## Related: Next.js ISR revalidation

Brand mutations also call `LandingRevalidationService.revalidateBrand(brandId)` to trigger Next.js ISR revalidation on the participant frontend. This is a parallel cache layer (Next.js page cache, not Redis) — handlers that need both call both. See `update-brand.handler.ts` for the pattern. The regression test treats `LandingRevalidationService` calls as satisfying invalidation coverage when paired with a controller-layer `@CacheInvalidate` for the Redis layer.

## Reference: existing patterns to copy

- Self-service portal mutation: `update-participant-profile.handler.ts:122-136`
- Admin acting on a participant: `review-application.handler.ts:111-138`
- Webhook/event with userId payload: `payment-events.controller.ts:240-280`
- Brand-level fan-out: `update-brand.handler.ts:60-80` (uses `invalidateBrandLandingCaches`)
- Program-level fan-out (with DB lookup): `manage-program-content.handlers.ts` `invalidatePricingTierCachesByProgramId` helper
- Invoice-specific bust: `payment-admin.controller.ts` `verifyInvoice` (uses `cacheService.invalidateInvoiceCache`)
