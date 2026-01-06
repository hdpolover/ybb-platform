import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProgramCategory } from '@prisma/client';

@Injectable()
export class PartnersSponsorsStrategy implements ILandingPageStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async getData(category: ProgramCategory | null) {
    const sponsors = category ? await this.prisma.sponsor.findMany({
        where: { programCategoryId: category.id, isActive: true },
        orderBy: { order: 'asc' }
    }) : [];

    const partners = category ? await this.prisma.programPartner.findMany({
         // Note: ProgramPartner is linked to Program, not directly to Category usually,
         // but we can fetch partners from all active programs of this category
         where: { 
             program: {
                 programCategoryId: category.id,
                 isActive: true
             },
             isActive: true
         },
         distinct: ['name'], // Simple distinct by name to avoid duplicates if same partner in multiple programs
         orderBy: { order: 'asc' }
    }) : [];

    return {
      slug: 'partners-sponsors',
      title: 'Partners & Sponsors',
      sections: [
        {
          type: 'hero',
          content: {
             headline: 'Our Valued Partners',
             subheadline: 'Collaborating to create global impact.',
          },
        },
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
      ],
    };
  }
}
