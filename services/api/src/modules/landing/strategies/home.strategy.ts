import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class HomeStrategy implements ILandingPageStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async getData() {
    const [mainCategory, latestProgram, sponsors] = await Promise.all([
      // Fetch main program category (brand info)
      this.prisma.programCategory.findFirst({
        where: { isActive: true },
      }),
      // Fetch the next upcoming active program
      this.prisma.program.findFirst({
        where: {
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
      // Fetch active sponsors
      this.prisma.sponsor.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      }),
    ]);

    return {
      slug: 'home',
      title: mainCategory?.name || 'Youth Break the Boundaries',
      sections: [
        {
          type: 'main_banner',
          content: {
            imageUrl: mainCategory?.bannerUrl || '',
            link: mainCategory?.websiteUrl || '',
            title: mainCategory?.name || '',
            subtitle: mainCategory?.description || '',
          },
        },
        {
          type: 'registration_overview',
          content: {
            ig_feed: [], // Placeholder: Integration with IG API would go here
            registration_types: latestProgram?.pricingTiers.map((tier) => ({
              id: tier.id,
              name: tier.name,
              price: tier.price,
              currency: tier.currency,
              benefits: tier.benefits,
            })) || [],
            guidelines: latestProgram?.resources.map((res) => ({
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
            about_us: mainCategory?.about || '',
            vision_mission: {
              vision: mainCategory?.vision || '',
              mission: mainCategory?.mission || '',
            },
          },
        },
        {
          type: 'program_highlights',
          content: {
            image_gallery: latestProgram?.gallery.map((img) => ({
              url: img.imageUrl,
              caption: img.title,
              type: img.type,
            })) || [],
            content: {
              title: 'Program Highlights',
              // TODO: Add a specific field for highlights in DB or parse from description
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
          data: sponsors.map((s) => ({
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
