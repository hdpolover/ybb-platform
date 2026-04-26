import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';

@Injectable()
export class PartnersSponsorsStrategy implements ILandingPageStrategy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) { }

  async getData(category: Brand | null) {
    // Check cache first
    const cacheKey = CACHE_KEYS.LANDING_PARTNERS(category?.id || 'default');
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

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

    const metadata = (category?.metadata ?? {}) as Record<string, unknown>;
    const partnersCanvaUrl = typeof metadata.partners_canva_url === 'string' && metadata.partners_canva_url.trim()
      ? metadata.partners_canva_url.trim()
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

    if (partnersCanvaUrl) {
      sections.push({
        type: 'canva_embed',
        content: { url: partnersCanvaUrl },
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
        },
      },
    );

    const result = {
      slug: 'partners-sponsors',
      title: 'Partners & Sponsors',
      sections,
    };

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, result, CACHE_TTL.HOUR);

    return result;
  }
}
