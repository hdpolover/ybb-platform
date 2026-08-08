import { Injectable, Logger } from '@nestjs/common';
import { Brand, Prisma } from '@prisma/client';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import {
  ActivityItem,
  ActivityRow,
  ACTIVITY_SOURCE_STATUSES,
  MAX_ACTIVITY_POOL_SIZE,
  MIN_ACTIVITY_POOL_SIZE,
  mapRowToActivityItem,
} from './activity.mapper';

export interface ActivityData {
  enabled: boolean;
  items: ActivityItem[];
}

const DISABLED: ActivityData = { enabled: false, items: [] };

@Injectable()
export class ActivityStrategy implements ILandingPageStrategy {
  private readonly logger = new Logger(ActivityStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) { }

  async getData(brand: Brand | null): Promise<ActivityData> {
    if (!brand) return DISABLED;

    const cacheKey = CACHE_KEYS.LANDING_ACTIVITY(brand.id);
    const cached = await this.cacheService.get<ActivityData>(cacheKey);
    if (cached) return cached;

    const data = await this.buildActivityData(brand.id);
    // The pool query orders by random(), so every cache expiry hands the caller a fresh
    // random sample of the brand's participants. At a 5 minute TTL a caller polling this
    // endpoint collects ~288 distinct samples per day and can enumerate an entire brand's
    // cohort within a day. The 1 hour TTL is deliberately doing double duty as a rate
    // limiter here, not just a freshness knob -- do not lower it for "fresher" activity.
    await this.cacheService.set(cacheKey, data, CACHE_TTL.HOUR);
    return data;
  }

  private async buildActivityData(brandId: string): Promise<ActivityData> {
    let rows: ActivityRow[];

    try {
      rows = await this.queryEligibleRows(brandId);
    } catch (error) {
      // Marketing garnish must never fail a landing page render.
      this.logger.warn(`Failed to load activity pool for brand ${brandId}: ${error}`);
      return DISABLED;
    }

    const items = rows
      .map(mapRowToActivityItem)
      .filter((item): item is ActivityItem => item !== null);

    if (items.length < MIN_ACTIVITY_POOL_SIZE) return DISABLED;

    return { enabled: true, items };
  }

  private queryEligibleRows(brandId: string): Promise<ActivityRow[]> {
    // Name and nationality come from participant_applications.personal_data, not from the
    // participants table -- participants.full_name can be a shortened version of what the
    // applicant submitted, and participants.nationality/nationality_code are dead columns
    // (empty on every row in production). personal_data is the authoritative source, same
    // as phone and birthdate elsewhere in this codebase. The participants join is kept only
    // for the deleted_at guard.
    return this.prisma.$queryRaw<ActivityRow[]>`
      SELECT
        pa.status::text                            AS status,
        pa.personal_data::jsonb->>'full_name'       AS full_name,
        pa.personal_data::jsonb->>'nationality'     AS nationality,
        pr.name                                     AS program_name
      FROM participant_applications pa
      JOIN participants p ON p.id = pa.participant_id
      JOIN programs pr ON pr.id = pa.program_id
      WHERE pa.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND pr.deleted_at IS NULL
        AND pr.brand_id = ${brandId}
        AND pr.is_published = true
        AND pa.status::text IN (${Prisma.join(ACTIVITY_SOURCE_STATUSES as string[])})
        AND btrim(pa.personal_data::jsonb->>'full_name') <> ''
        AND btrim(pa.personal_data::jsonb->>'nationality') <> ''
      ORDER BY random()
      LIMIT ${MAX_ACTIVITY_POOL_SIZE}
    `;
  }
}
