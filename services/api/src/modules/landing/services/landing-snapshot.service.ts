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
const DEFAULT_SNAPSHOT_SCHEMA_VERSION = 1;

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
    build: SnapshotBuilder<LandingPageResponseDto>,
  ): Promise<LandingPageResponseDto> {
    return this.getOrBuildSnapshot(
      brand,
      PROGRAMS_PAGE,
      ROOT_SLUG,
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
    const cacheKey = CACHE_KEYS.LANDING_SNAPSHOT(brand.id, page, normalizedSlug);
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

    if (snapshot && this.isSnapshotFresh(snapshot.publishedAt, ttl)) {
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
        schemaVersion: DEFAULT_SNAPSHOT_SCHEMA_VERSION,
        publishedAt: new Date(),
      },
      update: {
        payloadJson,
        schemaVersion: DEFAULT_SNAPSHOT_SCHEMA_VERSION,
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
