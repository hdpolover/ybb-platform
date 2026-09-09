import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import { Prisma, type Brand } from '@prisma/client';
import { LandingPageResponseDto } from '../dto/landing-page.dto';
import { LandingSettingsResponseDto } from '../dto/landing-settings.dto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';

const ROOT_SLUG = '';
const HOME_PAGE = 'home';
const PROGRAMS_PAGE = 'programs';
const PROGRAM_DETAIL_PAGE = 'program-detail';
const ABOUT_PAGE = 'about';
const FAQS_PAGE = 'faqs';
const PARTNERS_PAGE = 'partners-sponsors';
const ANNOUNCEMENTS_PAGE = 'announcements';
const SETTINGS_PAGE = 'settings';
/**
 * Snapshots are cached for CACHE_TTL.HOUR in Redis *and* persisted in
 * brand_landing_snapshots, and nothing busts either one when the payload
 * shape changes. A deploy that alters a landing strategy therefore kept
 * serving the pre-deploy payload for up to an hour, and the only way to see
 * the new shape was to delete the rows and Redis keys by hand.
 *
 * Deriving the version from the compiled bundle's mtime makes every deploy a
 * new version: stable across restarts of the same image, different for each
 * new one, and no constant for anyone to remember to bump. Hashed into a
 * signed-int range because schema_version is a Postgres int4. A collision
 * would only mean one snapshot lives out its TTL, so cheap entropy is fine.
 */
const SNAPSHOT_SCHEMA_VERSION = ((): number => {
  try {
    const fingerprint = String(statSync(__filename).mtimeMs);
    return parseInt(createHash('sha1').update(fingerprint).digest('hex').slice(0, 7), 16);
  } catch {
    return 1;
  }
})();

type SnapshotBuilder<T> = () => Promise<T>;
type SnapshotValidator<T> = (payload: Prisma.JsonValue) => T | null;

@Injectable()
export class LandingSnapshotService {
  /**
   * M192: in-process single-flight for the rebuild-and-persist step below,
   * keyed by the same versioned cache key a request already computes.
   * Without this, every concurrent request that misses at the same moment
   * (the normal shape of TTL expiry on a busy page: N requests arrive
   * before the first rebuild finishes, not one at a time) independently ran
   * `build()` - which can itself be several DB queries / other services -
   * and independently upserted brand_landing_snapshots. N simultaneous
   * misses cost N builds for one page.
   *
   * IN-PROCESS ONLY, deliberately not distributed. This collapses
   * concurrent requests landing on the SAME replica. There are 2 API
   * replicas, so a miss that lands on both at once still runs build() twice
   * - once per process - and this map cannot see across that boundary. That
   * residual duplication is bounded by replica count, not request count,
   * which is the actual problem this fixes (unbounded fan-out at TTL
   * expiry). A distributed lock (Redis SETNX or similar) would close the
   * cross-replica gap too, but was deliberately not added: this is a
   * cache-warming path that already fails safe (worst case on a miss is a
   * redundant rebuild, never wrong data), so trading that for a new failure
   * mode - a stuck lock stalling every replica's rebuild if a lock-holder
   * dies mid-build - is not a trade worth making here.
   */
  private readonly inFlightBuilds = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async getOrBuildFaqSnapshot(
    brand: Brand,
    build: SnapshotBuilder<LandingPageResponseDto>,
  ): Promise<LandingPageResponseDto> {
    return this.getOrBuildSnapshot(
      brand,
      FAQS_PAGE,
      ROOT_SLUG,
      build,
      CACHE_TTL.LONG,
      this.toLandingPagePayload.bind(this),
    );
  }

  async getOrBuildHomeSnapshot(
    brand: Brand,
    build: SnapshotBuilder<LandingPageResponseDto>,
  ): Promise<LandingPageResponseDto> {
    return this.getOrBuildSnapshot(
      brand,
      HOME_PAGE,
      ROOT_SLUG,
      build,
      CACHE_TTL.HOUR,
      this.toLandingPagePayload.bind(this),
    );
  }

  async getOrBuildProgramsSnapshot(
    brand: Brand,
    editionSlug: string | null,
    build: SnapshotBuilder<LandingPageResponseDto>,
  ): Promise<LandingPageResponseDto> {
    // `editionSlug` is the RESOLVED edition (see ProgramsStrategy.resolveEditionSlug),
    // not the raw `edition` query param, so this snapshot never serves one
    // edition's hero/overview/activities/schedules/FAQs for another (MEYS
    // 6th/7th concurrent-active-programs bug). Brands with no currently-open
    // editions pass null and keep today's single ROOT_SLUG row.
    return this.getOrBuildSnapshot(
      brand,
      PROGRAMS_PAGE,
      editionSlug ?? ROOT_SLUG,
      build,
      CACHE_TTL.HOUR,
      this.toLandingPagePayload.bind(this),
    );
  }

  async getOrBuildProgramDetailSnapshot(
    brand: Brand,
    slug: string,
    build: SnapshotBuilder<LandingPageResponseDto>,
  ): Promise<LandingPageResponseDto> {
    return this.getOrBuildSnapshot(
      brand,
      PROGRAM_DETAIL_PAGE,
      slug,
      build,
      CACHE_TTL.HOUR,
      this.toLandingPagePayload.bind(this),
    );
  }

  async getOrBuildAboutSnapshot(
    brand: Brand,
    build: SnapshotBuilder<LandingPageResponseDto>,
  ): Promise<LandingPageResponseDto> {
    return this.getOrBuildSnapshot(
      brand,
      ABOUT_PAGE,
      ROOT_SLUG,
      build,
      CACHE_TTL.HOUR,
      this.toLandingPagePayload.bind(this),
    );
  }

  async getOrBuildAnnouncementsSnapshot(
    brand: Brand,
    build: SnapshotBuilder<LandingPageResponseDto>,
  ): Promise<LandingPageResponseDto> {
    return this.getOrBuildSnapshot(
      brand,
      ANNOUNCEMENTS_PAGE,
      ROOT_SLUG,
      build,
      CACHE_TTL.LONG,
      this.toLandingPagePayload.bind(this),
    );
  }

  async getOrBuildPartnersSnapshot(
    brand: Brand,
    build: SnapshotBuilder<LandingPageResponseDto>,
  ): Promise<LandingPageResponseDto> {
    return this.getOrBuildSnapshot(
      brand,
      PARTNERS_PAGE,
      ROOT_SLUG,
      build,
      CACHE_TTL.HOUR,
      this.toLandingPagePayload.bind(this),
    );
  }

  async getOrBuildSettingsSnapshot(
    brand: Brand,
    build: SnapshotBuilder<LandingSettingsResponseDto>,
  ): Promise<LandingSettingsResponseDto> {
    return this.getOrBuildSnapshot(
      brand,
      SETTINGS_PAGE,
      ROOT_SLUG,
      build,
      CACHE_TTL.HOUR,
      this.toLandingSettingsPayload.bind(this),
    );
  }

  private async getOrBuildSnapshot<T>(
    brand: Brand,
    page: string,
    slug: string,
    build: SnapshotBuilder<T>,
    ttl: number,
    validate: SnapshotValidator<T>,
  ): Promise<T> {
    const normalizedSlug = slug || ROOT_SLUG;
    // Version in the key so a deploy cannot serve a previous build's Redis
    // entry either. Orphaned keys expire on their own TTL.
    const cacheKey = `${CACHE_KEYS.LANDING_SNAPSHOT(brand.id, page, normalizedSlug)}:v${SNAPSHOT_SCHEMA_VERSION}`;
    const cached = await this.cacheService.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const snapshot = await this.prisma.brandLandingSnapshot.findUnique({
      where: {
        brandId_page_slug: {
          brandId: brand.id,
          page,
          slug: normalizedSlug,
        },
      },
    });

    // A snapshot built by an older bundle can hold a payload shape this build
    // no longer produces, so version mismatch means stale regardless of age.
    if (snapshot && snapshot.schemaVersion === SNAPSHOT_SCHEMA_VERSION && this.isSnapshotFresh(snapshot.publishedAt, ttl)) {
      const payload = validate(snapshot.payloadJson);
      if (payload) {
        await this.cacheService.set(cacheKey, payload, ttl);
        return payload;
      }
    }

    return this.rebuildAndPersist(cacheKey, brand, page, normalizedSlug, build, ttl);
  }

  /**
   * The actual rebuild, single-flighted per cacheKey - see inFlightBuilds
   * above for why. A concurrent caller that finds an in-flight promise for
   * this exact key awaits THAT instead of starting its own build()/upsert().
   */
  private rebuildAndPersist<T>(
    cacheKey: string,
    brand: Brand,
    page: string,
    normalizedSlug: string,
    build: SnapshotBuilder<T>,
    ttl: number,
  ): Promise<T> {
    const inFlight = this.inFlightBuilds.get(cacheKey) as Promise<T> | undefined;
    if (inFlight) return inFlight;

    const promise = (async (): Promise<T> => {
      const payload = await build();
      const payloadJson: Prisma.InputJsonValue = JSON.parse(JSON.stringify(payload));
      await this.prisma.brandLandingSnapshot.upsert({
        where: {
          brandId_page_slug: {
            brandId: brand.id,
            page,
            slug: normalizedSlug,
          },
        },
        create: {
          brandId: brand.id,
          page,
          slug: normalizedSlug,
          payloadJson,
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          publishedAt: new Date(),
        },
        update: {
          payloadJson,
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          publishedAt: new Date(),
        },
      });

      await this.cacheService.set(cacheKey, payload, ttl);
      return payload;
    })();

    this.inFlightBuilds.set(cacheKey, promise);

    // Cleared on settle either way - success or failure - so a failed build
    // does not wedge this key forever and the next miss gets to try again.
    // Guarded against clobbering a NEWER entry: cleanup running after this
    // key has already been reused (only possible once this promise has
    // itself settled, but ordering of async cleanup is never guaranteed)
    // must not delete someone else's in-flight build.
    // .catch() here is only to keep this cleanup-only derived promise from
    // becoming a second, unhandled rejection - `promise` itself, returned
    // below, still rejects normally for whoever actually awaits it.
    void promise
      .finally(() => {
        if (this.inFlightBuilds.get(cacheKey) === promise) {
          this.inFlightBuilds.delete(cacheKey);
        }
      })
      .catch(() => undefined);

    return promise;
  }

  private isSnapshotFresh(publishedAt: Date, ttl: number): boolean {
    return Date.now() - publishedAt.getTime() <= ttl;
  }

  private toLandingPagePayload(payload: Prisma.JsonValue): LandingPageResponseDto | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const candidate = payload as Record<string, unknown>;
    if (
      typeof candidate.slug === 'string' &&
      typeof candidate.title === 'string' &&
      Array.isArray(candidate.sections)
    ) {
      return candidate as unknown as LandingPageResponseDto;
    }

    return null;
  }

  private toLandingSettingsPayload(payload: Prisma.JsonValue): LandingSettingsResponseDto | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const candidate = payload as Record<string, unknown>;
    if (
      candidate.maintenance &&
      typeof candidate.maintenance === 'object' &&
      candidate.brand &&
      typeof candidate.brand === 'object' &&
      Array.isArray(candidate.footer_navigation) &&
      candidate.currency &&
      typeof candidate.currency === 'object'
    ) {
      return candidate as unknown as LandingSettingsResponseDto;
    }

    return null;
  }
}
