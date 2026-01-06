import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ProgramCategory } from '@prisma/client';

@Injectable()
export class HomeStrategy implements ILandingPageStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async getData(category: ProgramCategory | null) {
    if (!category) {
       // Return default or throw? returning empty structure for now
       return {
         slug: 'home',
         title: 'Youth Break the Boundaries', // Default fallback
         sections: [],
       };
    }

    const [program, brandSponsors] = await Promise.all([
      this.prisma.program.findFirst({
        where: {
          programCategoryId: category.id, // Scoped to brand
          isPublished: true,
          isActive: true,
        },
        orderBy: { startDate: 'asc' },
        include: {
          gallery: {
            where: { isActive: true },
            take: 6,
            orderBy: { order: 'asc' },
          },
          pricingTiers: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
          },
          resources: {
            where: { isActive: true, isPublic: true },
            take: 5,
            orderBy: { order: 'asc' },
          },
        },
      }),
      this.prisma.sponsor.findMany({
        where: { 
            programCategoryId: category.id, // Scoped to brand
            isActive: true 
        },
        orderBy: { order: 'asc' },
      }),
    ]);

    return {
      slug: 'home',
      title: category.name,
      sections: [
        {
          type: 'main_banner',
          content: {
            imageUrl: category.bannerUrl || '',
            link: category.websiteUrl || '',
            title: category.name || '',
            subtitle: category.description || '',
          },
        },
        {
          type: 'registration_overview',
          content: {
            ig_feed: [], // Placeholder
            registration_types: program?.pricingTiers.map((tier) => ({
              id: tier.id,
              name: tier.name,
              price: tier.price,
              currency: tier.currency,
              benefits: tier.benefits,
            })) || [],
            guidelines: program?.resources.map((res) => ({
              id: res.id,
              title: res.title,
              type: res.type,
              url: res.fileUrl,
            })) || [],
          },
        },
        {
          type: 'program_overview',
          content: {
            about_us: category.about || '',
            vision_mission: {
              vision: category.vision || '',
              mission: category.mission || '',
            },
          },
        },
        {
          type: 'program_highlights',
          content: {
            image_gallery: program?.gallery.map((img) => ({
              url: img.imageUrl,
              caption: img.title,
              type: img.type,
            })) || [],
            content: {
              title: 'Program Highlights',
              items: [
                'International Networking',
                'Cultural Exchange',
                'Leadership Workshops',
                'Global Project Collaboration',
              ],
            },
          },
        },
        {
          type: 'supported_by',
          data: brandSponsors.map((s) => ({
            id: s.id,
            name: s.name,
            logoUrl: s.logoUrl,
            websiteUrl: s.websiteUrl,
            type: s.type,
            tier: s.tier,
          })),
        },
      ],
    };
  }

  private async getStats() {
    const [programsCount, participantsCount, countriesCount] = await Promise.all([
      this.prisma.program.count({ where: { isPublished: true } }),
      this.prisma.participant.count(),
      // distinct countries is harder with simple count, approximating or skipping for now
      Promise.resolve(50), // Placeholder for countries
    ]);

    return {
      programs: programsCount,
      participants: participantsCount,
      countries: countriesCount,
    };
  }
}
