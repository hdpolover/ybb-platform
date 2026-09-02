import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ILandingPageStrategy } from './strategies/landing-page.strategy';
import { HomeStrategy } from './strategies/home.strategy';
import { AboutStrategy } from './strategies/about.strategy';
import { ProgramsStrategy } from './strategies/programs.strategy';
import { PartnersSponsorsStrategy } from './strategies/partners-sponsors.strategy';
import { AnnouncementsStrategy } from './strategies/announcements.strategy';
import { SettingsStrategy } from './strategies/settings.strategy';
import { FaqsStrategy } from './strategies/faqs.strategy';
import { ActivityStrategy } from './strategies/activity.strategy';
import { Brand } from '@prisma/client';
import { LandingPageResponseDto } from './dto/landing-page.dto';
import { LandingSettingsResponseDto } from './dto/landing-settings.dto';
import { LandingActivityResponseDto } from './dto/landing-activity.dto';
import { LandingSnapshotService } from './services/landing-snapshot.service';
import { resolveEditionSlug } from './strategies/registration-editions.util';
import { ListAnnouncementsQueryDto } from './dto/landing-announcements-query.dto';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../shared/constants/cache-keys';

const DEFAULT_FAQ_LIMIT = 200;
const DEFAULT_BRAND_CACHE_KEY = '__default__';

@Injectable()
export class LandingService {
  private strategies: Record<string, ILandingPageStrategy> = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly homeStrategy: HomeStrategy,
    private readonly aboutStrategy: AboutStrategy,
    private readonly programsStrategy: ProgramsStrategy,
    private readonly partnersSponsorsStrategy: PartnersSponsorsStrategy,
    private readonly announcementsStrategy: AnnouncementsStrategy,
    private readonly settingsStrategy: SettingsStrategy,
    private readonly faqsStrategy: FaqsStrategy,
    private readonly activityStrategy: ActivityStrategy,
    private readonly landingSnapshotService: LandingSnapshotService,
    private readonly cacheService: CacheService,
  ) { }

  // Public: reused by the Meta CAPI module (MetaCapiService) to resolve a brand
  // by its request Origin/Referer host without duplicating brand-by-domain
  // lookup logic.
  //
  // Cached for CACHE_TTL.MEDIUM (5 min) — this ran 1-2 uncached brand
  // queries on EVERY /landing/* request, ahead of the snapshot cache check.
  // Only a resolved brand is cached; the not-found path always hits the DB
  // so a newly-added brand domain doesn't have to wait out a stale miss.
  async resolveBrand(url?: string): Promise<Brand | null> {
    const cacheKey = CACHE_KEYS.LANDING_BRAND_RESOLVE(url ? url.trim().toLowerCase() : DEFAULT_BRAND_CACHE_KEY);
    const cached = await this.cacheService.get<Brand>(cacheKey);
    if (cached) {
      return cached;
    }

    const brand = await this.resolveBrandUncached(url);
    if (brand) {
      await this.cacheService.set(cacheKey, brand, CACHE_TTL.MEDIUM);
    }
    return brand;
  }

  private async resolveBrandUncached(url?: string): Promise<Brand | null> {
    if (!url) {
      // Return default active brand if no URL specified, likely the main YBB one
      return this.prisma.brand.findFirst({
        where: { isActive: true },
        // Prefer one marked as 'default' if we had such flag, or specific slug
        // For now, any active one or 'ybb' specifically if we wanted to enforce default
        orderBy: { createdAt: 'asc' }
      });
    }

    // Check if input is UUID (Brand ID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url);
    if (isUuid) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: url, isActive: true }
      });
      if (brand) return brand;
    }

    // Try to find by exact URL match (most reliable)
    let brand = await this.prisma.brand.findFirst({
      where: {
        websiteUrl: url,
        isActive: true
      },
    });

    if (!brand) {
      // Try to find if the stored url contains the request url (e.g request: domain.com, stored: https://domain.com)
      brand = await this.prisma.brand.findFirst({
        where: {
          websiteUrl: { contains: url, mode: 'insensitive' },
          isActive: true
        }
      });
    }

    if (!brand) {
      throw new NotFoundException(`No brand found for URL: ${url}`);
    }

    return brand;
  }

  async getHome(url?: string): Promise<LandingPageResponseDto> {
    const brand = await this.resolveBrand(url);
    if (brand) {
      return this.landingSnapshotService.getOrBuildHomeSnapshot(
        brand,
        () => this.homeStrategy.getData(brand) as Promise<LandingPageResponseDto>,
      );
    }
    return this.homeStrategy.getData(brand) as Promise<LandingPageResponseDto>;
  }

  async getActivity(url?: string): Promise<LandingActivityResponseDto> {
    const brand = await this.resolveBrand(url);
    const data = await this.activityStrategy.getData(brand);
    // Explicit field mapping: this route is public/unauthenticated, so this is the
    // last line of defence against a field added to ActivityItem upstream leaking here.
    return {
      enabled: data.enabled,
      items: data.items.map((item) => ({
        type: item.type,
        name: item.name,
        country: item.country,
        countryCode: item.countryCode,
        programName: item.programName,
      })),
    };
  }

  async getAbout(url?: string): Promise<LandingPageResponseDto> {
    const brand = await this.resolveBrand(url);
    return this.aboutStrategy.getData(brand) as Promise<LandingPageResponseDto>;
  }

  async getPrograms(url?: string, edition?: string): Promise<LandingPageResponseDto> {
    const brand = await this.resolveBrand(url);
    if (brand) {
      // Resolved (not raw) edition slug, so the snapshot cache key can never
      // mix up two editions' pages (see MEYS 6th/7th concurrent-active-
      // programs bug). `programsStrategy.getData` re-resolves the same slug
      // from the same DB state internally to build the actual payload.
      const resolvedEditionSlug = await resolveEditionSlug(this.prisma, this.cacheService, brand.id, edition, new Date());
      return this.landingSnapshotService.getOrBuildProgramsSnapshot(
        brand,
        resolvedEditionSlug,
        () => this.programsStrategy.getData(brand, edition) as Promise<LandingPageResponseDto>,
      );
    }
    return this.programsStrategy.getData(brand, edition) as Promise<LandingPageResponseDto>;
  }

  async getProgramDetail(slug: string, url?: string): Promise<LandingPageResponseDto> {
    const brand = await this.resolveBrand(url);
    if (brand) {
      return this.landingSnapshotService.getOrBuildProgramDetailSnapshot(
        brand,
        slug,
        () => this.programsStrategy.getProgramData(slug, brand) as Promise<LandingPageResponseDto>,
      );
    }
    return this.programsStrategy.getProgramData(slug, brand) as Promise<LandingPageResponseDto>;
  }

  async getPartnersSponsors(url?: string): Promise<LandingPageResponseDto> {
    const brand = await this.resolveBrand(url);
    return this.partnersSponsorsStrategy.getData(brand) as Promise<LandingPageResponseDto>;
  }

  async getAnnouncements(url?: string, query: ListAnnouncementsQueryDto = {}): Promise<LandingPageResponseDto> {
    const brand = await this.resolveBrand(url);
    return this.announcementsStrategy.getAnnouncements(brand, query) as Promise<LandingPageResponseDto>;
  }

  async getFaqs(url?: string, page: number = 1, limit: number = DEFAULT_FAQ_LIMIT, search?: string): Promise<LandingPageResponseDto> {
    const brand = await this.resolveBrand(url);
    // FaqsStrategy has a specific getFaqs method with pagination
    return this.faqsStrategy.getFaqs(brand, page, limit, search) as Promise<LandingPageResponseDto>;
  }

  async getSettings(url?: string): Promise<LandingSettingsResponseDto> {
    const brand = await this.resolveBrand(url);
    return this.settingsStrategy.getData(brand);
  }
}
