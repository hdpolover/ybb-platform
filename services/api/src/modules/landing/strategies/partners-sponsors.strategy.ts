import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';
import { LandingSnapshotService } from '../services/landing-snapshot.service';
import { LandingPageResponseDto } from '../dto/landing-page.dto';

@Injectable()
export class PartnersSponsorsStrategy implements ILandingPageStrategy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly landingSnapshotService: LandingSnapshotService,
  ) { }

  async getData(category: Brand | null) {
    if (category) {
      return this.landingSnapshotService.getOrBuildPartnersSnapshot(
        category,
        () => this.buildPartnersPayload(category),
      );
    }

    // Check cache first
    const cacheKey = CACHE_KEYS.LANDING_PARTNERS('default');
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.buildPartnersPayload(category);

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, result, CACHE_TTL.HOUR);

    return result;
  }

  private async buildPartnersPayload(category: Brand | null): Promise<LandingPageResponseDto> {

    const sponsors = category ? await this.prisma.sponsor.findMany({
      where: { brandId: category.id, isActive: true },
      orderBy: { order: 'asc' }
    }) : [];

    const partners = category ? await this.prisma.programPartner.findMany({
      // Note: ProgramPartner is linked to Program, not directly to Category usually,
      // but we can fetch partners from all active programs of this category
      where: {
        program: {
          brandId: category.id,
          isActive: true
        },
        isActive: true
      },
      distinct: ['name'], // Simple distinct by name to avoid duplicates if same partner in multiple programs
      orderBy: { order: 'asc' }
    }) : [];

    // Per-program Canva embeds — see program.prisma's partnersCanvaUrl
    // field comment. One brand can have several programs live at once, and
    // each program owns its own embed URL now (rather than sharing the
    // single legacy Brand.metadata.partners_canva_url slot below), so we
    // pull it straight from the same active-programs query the partners
    // grid already scopes to instead of a second query.
    const activeProgramsWithCanva = category
      ? await this.prisma.program.findMany({
        where: {
          brandId: category.id,
          isActive: true,
          partnersCanvaUrl: { not: null },
        },
        select: { id: true, name: true, partnersCanvaUrl: true },
        orderBy: { startDate: 'asc' },
      })
      : [];

    const metadata = (category?.metadata ?? {}) as Record<string, unknown>;
    // Legacy brand-level fallback: only rendered when no active program has
    // set its own partnersCanvaUrl yet, so brands mid-migration to the
    // per-program field keep showing something instead of going blank.
    const legacyPartnersCanvaUrl = typeof metadata.partners_canva_url === 'string' && metadata.partners_canva_url.trim()
      ? metadata.partners_canva_url.trim()
      : null;

    // Brand-level affiliate commission overrides. Stored under
    // metadata.affiliateCommission as { fullyFundedPct, selfFundedPct } via the
    // brand metadata admin endpoint. The frontend expects snake_case keys here,
    // so we translate at the boundary.
    const affiliateRaw = (metadata.affiliateCommission ?? null) as
      | { fullyFundedPct?: unknown; selfFundedPct?: unknown }
      | null;
    const fullyFundedPct =
      typeof affiliateRaw?.fullyFundedPct === 'number' ? affiliateRaw.fullyFundedPct : null;
    const selfFundedPct =
      typeof affiliateRaw?.selfFundedPct === 'number' ? affiliateRaw.selfFundedPct : null;
    const affiliateCommission =
      fullyFundedPct !== null && selfFundedPct !== null
        ? { fully_funded_pct: fullyFundedPct, self_funded_pct: selfFundedPct }
        : null;

    const sections: unknown[] = [
      {
        type: 'hero',
        content: {
          headline: 'Our Valued Partners',
          subheadline: 'Collaborating to create global impact.',
        },
      },
    ];

    if (activeProgramsWithCanva.length > 0) {
      for (const program of activeProgramsWithCanva) {
        sections.push({
          type: 'canva_embed',
          content: {
            url: program.partnersCanvaUrl as string,
            program_id: program.id,
            program_name: program.name,
          },
        });
      }
    } else if (legacyPartnersCanvaUrl) {
      sections.push({
        type: 'canva_embed',
        content: { url: legacyPartnersCanvaUrl, program_id: null, program_name: null },
      });
    }

    sections.push(
      {
        type: 'sponsors_grid',
        data: sponsors.map(s => ({
          id: s.id,
          name: s.name,
          logo: s.logoUrl,
          website: s.websiteUrl,
          tier: s.tier
        })),
      },
      {
        type: 'partners_grid',
        data: partners.map(p => ({
          id: p.id,
          name: p.name,
          logo: p.logoUrl,
          website: p.websiteUrl,
          type: p.type
        })),
      },
      {
        type: 'cta_become_partner',
        content: {
          text: 'Interested in partnering with us?',
          link: '/contact',
          ...(affiliateCommission ? { affiliate_commission: affiliateCommission } : {}),
        },
      },
    );

    const result = {
      slug: 'partners-sponsors',
      title: 'Partners & Sponsors',
      sections,
    };
    return result as LandingPageResponseDto;
  }
}
