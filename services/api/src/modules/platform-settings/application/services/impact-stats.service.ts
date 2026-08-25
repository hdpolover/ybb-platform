// services/api/src/modules/platform-settings/application/services/impact-stats.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingRepository } from '../../infrastructure/persistence/platform-setting.repository';
import { LandingCacheInvalidationService } from '@modules/brands/application/services/landing-cache-invalidation.service';
import { ImpactStats, ImpactStatsDto } from '../dto/impact-stats.dto';

const IMPACT_STATS_KEY = 'impact_stats';

type RawImpactStats = {
  total_alumni?: string;
  editions_held?: string;
  total_countries?: string;
  total_participants?: string;
};

// impact_stats is a single organisation-wide row (SUPER_ADMIN-gated, edited
// rarely, one row total). update() upserts rather than requiring an existing
// row: PlatformSettingRepository.upsert() is an atomic Prisma upsert, so the
// first-ever write needs no separate bootstrap path. The read-merge-write of
// the JSON blob above that upsert is NOT atomic — two concurrent PUTs could
// both read the same existing value and the later upsert wins, silently
// dropping the earlier writer's change to a different sub-field. Accepted
// here given the access pattern (single SUPER_ADMIN editing a rarely-touched
// settings screen); revisit with optimistic locking if this ever becomes a
// multi-editor surface.
@Injectable()
export class ImpactStatsService {
  private readonly logger = new Logger(ImpactStatsService.name);

  constructor(
    private readonly repository: PlatformSettingRepository,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
  ) {}

  async get(): Promise<ImpactStats> {
    const row = await this.repository.get(IMPACT_STATS_KEY);
    const raw = (row?.value as RawImpactStats) ?? {};
    return {
      totalAlumni: raw.total_alumni ?? null,
      editionsHeld: raw.editions_held ?? null,
      totalCountries: raw.total_countries ?? null,
      totalParticipants: raw.total_participants ?? null,
    };
  }

  async update(patch: ImpactStatsDto, updatedBy: string): Promise<ImpactStats> {
    const row = await this.repository.get(IMPACT_STATS_KEY);
    const existing = (row?.value as RawImpactStats) ?? {};
    const merged: RawImpactStats = {
      ...existing,
      ...(patch.totalAlumni !== undefined && { total_alumni: patch.totalAlumni }),
      ...(patch.editionsHeld !== undefined && { editions_held: patch.editionsHeld }),
      ...(patch.totalCountries !== undefined && { total_countries: patch.totalCountries }),
      ...(patch.totalParticipants !== undefined && { total_participants: patch.totalParticipants }),
    };
    await this.repository.upsert(IMPACT_STATS_KEY, merged, updatedBy);

    // impact_stats is a SINGLE PlatformSetting row read by every brand's
    // home page (home.strategy.ts), unlike every other landing-cache write
    // in this codebase which is scoped to one brandId. A single-brand
    // invalidate() call would leave the other 7 brands serving a stale
    // landing:home:{brandId} entry (and stale brand_landing_snapshots row,
    // and stale Next.js unstable_cache) indefinitely, until their TTL
    // happens to expire — so this must fan out to every active brand.
    // bustProgramCache: false — impact_stats has nothing to do with
    // program-scoped cache; scanning program:* here would be pure waste.
    //
    // A partial fan-out failure is logged loudly but does NOT fail this
    // request: the PlatformSetting row is already correctly written by the
    // time this runs, matching the swallow convention every other landing
    // cache invalidation call site in this codebase already follows (a
    // stale-until-TTL page is the accepted fallback, not a 500 on a write
    // that already succeeded). See LandingCacheInvalidationService.
    // invalidateForAllBrands for how a per-brand failure is still surfaced
    // instead of silently reported as success.
    const result = await this.landingCacheInvalidation.invalidateForAllBrands({
      bustProgramCache: false,
      clearSnapshot: true,
      revalidate: { kind: 'homeAndSettings' },
    });
    if (result.failed.length > 0) {
      const total = result.succeeded.length + result.failed.length;
      this.logger.error(
        `impact_stats cache purge: ${result.failed.length}/${total} brand(s) failed and may serve stale ` +
          `impact stats until their cache TTL expires. Failed brand ids: ${result.failed.map((f) => f.brandId).join(', ')}`,
      );
    }

    return this.get();
  }
}
