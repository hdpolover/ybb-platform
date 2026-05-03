import { Injectable } from '@nestjs/common';
import { Prisma, type Brand } from '@prisma/client';
import { LandingPageResponseDto } from '../dto/landing-page.dto';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';

const ROOT_SLUG = '';
const FAQS_PAGE = 'faqs';
const PARTNERS_PAGE = 'partners-sponsors';
const DEFAULT_SNAPSHOT_SCHEMA_VERSION = 1;

type SnapshotBuilder = () => Promise<LandingPageResponseDto>;

@Injectable()
export class LandingSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async getOrBuildFaqSnapshot(
    brand: Brand,
    build: SnapshotBuilder,
  ): Promise<LandingPageResponseDto> {
    return this.getOrBuildPageSnapshot(brand, FAQS_PAGE, build);
  }

  async getOrBuildPartnersSnapshot(
    brand: Brand,
    build: SnapshotBuilder,
  ): Promise<LandingPageResponseDto> {
    return this.getOrBuildPageSnapshot(brand, PARTNERS_PAGE, build);
  }

  private async getOrBuildPageSnapshot(
    brand: Brand,
    page: string,
    build: SnapshotBuilder,
  ): Promise<LandingPageResponseDto> {
    const cacheKey = CACHE_KEYS.LANDING_SNAPSHOT(brand.id, page, ROOT_SLUG);
    const cached = await this.cacheService.get<LandingPageResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const snapshot = await this.prisma.brandLandingSnapshot.findUnique({
      where: {
        brandId_page_slug: {
          brandId: brand.id,
          page,
          slug: ROOT_SLUG,
        },
      },
    });

    if (snapshot && this.isSnapshotFresh(snapshot.publishedAt)) {
      const payload = this.toLandingFaqPayload(snapshot.payloadJson);
      if (payload) {
        await this.cacheService.set(cacheKey, payload, CACHE_TTL.LONG);
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
          slug: ROOT_SLUG,
        },
      },
      create: {
        brandId: brand.id,
        page,
        slug: ROOT_SLUG,
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

    await this.cacheService.set(cacheKey, payload, CACHE_TTL.LONG);
    return payload;
  }

  private isSnapshotFresh(publishedAt: Date): boolean {
    return Date.now() - publishedAt.getTime() <= CACHE_TTL.LONG;
  }

  private toLandingFaqPayload(payload: Prisma.JsonValue): LandingPageResponseDto | null {
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
}
