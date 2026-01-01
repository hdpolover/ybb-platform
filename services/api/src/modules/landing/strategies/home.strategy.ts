import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class HomeStrategy implements ILandingPageStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async getData() {
    const [programs, testimonials, sponsors, stats] = await Promise.all([
      // Fetch active programs
      this.prisma.program.findMany({
        where: {
          isPublished: true,
          isVisibleToUsers: true,
          isActive: true,
        },
        take: 3,
        orderBy: {
          startDate: 'asc',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          thumbnailUrl: true,
          startDate: true,
          endDate: true,
          location: true,
        },
      }),
      // Fetch featured testimonials
      this.prisma.programTestimonial.findMany({
        where: {
          isFeatured: true,
          isActive: true,
        },
        take: 5,
        orderBy: {
          order: 'asc',
        },
      }),
      // Fetch active sponsors
      this.prisma.sponsor.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          order: 'asc',
        },
      }),
      // Fetch basic stats
      this.getStats(),
    ]);

    return {
      slug: 'home',
      title: 'Welcome to YBB',
      sections: [
        {
          type: 'hero',
          content: {
            headline: 'Empowering Youth Beyond Borders',
            subheadline: 'Join our global programs and make a difference.',
            cta: { text: 'Explore Programs', link: '/programs' },
          },
        },
        {
          type: 'stats',
          data: stats,
        },
        {
          type: 'featured_programs',
          title: 'Upcoming Programs',
          data: programs,
        },
        {
          type: 'testimonials',
          title: 'What Our Alumni Say',
          data: testimonials,
        },
        {
          type: 'sponsors',
          title: 'Our Partners & Sponsors',
          data: sponsors,
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
