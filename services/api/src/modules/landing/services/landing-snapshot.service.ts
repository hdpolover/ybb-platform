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
