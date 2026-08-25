// services/api/src/modules/platform-settings/application/services/impact-stats.service.ts
import { Injectable } from '@nestjs/common';
import { PlatformSettingRepository } from '../../infrastructure/persistence/platform-setting.repository';
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
  constructor(private readonly repository: PlatformSettingRepository) {}

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
    return this.get();
  }
}
