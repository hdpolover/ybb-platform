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

    const [program, brandSponsors, socialFeeds, videoPrograms, testimonials, latestProgramWithAwards] = await Promise.all([
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
      this.prisma.programSocialFeed.findMany({
        where: {
            programCategoryId: category.id,
            isActive: true
        },
        orderBy: { postedAt: 'desc' },
        take: 6
      }),
      this.prisma.program.findMany({
        where: {
          programCategoryId: category.id,
          isPublished: true,
        },
        orderBy: { year: 'desc' },
        take: 5,
        select: {
            id: true,
            name: true,
            year: true,
            gallery: {
                where: { type: 'video', isActive: true },
                orderBy: { order: 'asc' },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    imageUrl: true,
                    videoUrl: true,
                }
            }
        }
      }),
      this.prisma.programTestimonial.findMany({
        where: {
            programCategoryId: category.id,
            category: 'alumni',
            isActive: true
        },
        orderBy: [
            { isFeatured: 'desc' }, // Featured first
            { order: 'asc' }
        ],
        take: 10
      }),
      // For Awards - Fetch the latest published program and its awards
      this.prisma.program.findFirst({
        where: {
            programCategoryId: category.id,
            isPublished: true,
            isActive: true
        },
        orderBy: { startDate: 'desc' }, // Latest program first
        select: {
            name: true,
            awards: {
                where: { isActive: true },
                orderBy: { order: 'asc' }
            }
        }
      })
    ]);

    // Filter out programs that don't have any videos
    const programsWithVideos = videoPrograms.filter(p => p.gallery && p.gallery.length > 0);

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
            ig_feed: socialFeeds.map(feed => ({
              id: feed.id,
              permalink: feed.permalink,
              imageUrl: feed.imageUrl,
              caption: feed.caption
            })),
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
          type: 'program_highlight_videos',
          content: {
            title: 'Experience Our Program in Action',
            subtitle: `Watch the journey of ${category.name} delegates – from keynote sessions and cultural experiences to collaboration and real impact projects.`,
            tabs: programsWithVideos.map(p => ({
              year: p.year,
              program_name: p.name,
              videos: p.gallery.map(v => ({
                id: v.id,
                title: v.title,
                description: v.description,
                thumbnail: v.imageUrl,
                video_url: v.videoUrl
              }))
            }))
          }
        },
        {
          type: 'alumni_stories',
          content: {
             title: 'What our Alumni says...',
             subtitle: 'MORE ALUMNI MOMENTS',
             items: testimonials.map(t => ({
                 id: t.id,
                 name: t.name,
                 role: t.role,
                 testimonial: t.testimonial,
                 type: t.type, // video or text
                 video_url: t.videoUrl,
                 thumbnail_url: t.thumbnailUrl,
                 avatar_url: t.avatarUrl,
                 is_featured: t.isFeatured
             }))
          }
        },
        {
          type: 'program_awards',
          content: {
            title: `Awards at ${latestProgramWithAwards?.name || category.name}`,
            subtitle: 'At JYS, we recognize students who lead, speak up, and make an impact. Your teen could be one of them!',
            items: latestProgramWithAwards?.awards.map(a => ({
              id: a.id,
              name: a.name,
              description: a.description,
              winner_count: a.winnerCount,
              tags: a.tags,
              color: a.color,
              icon_url: a.iconUrl // e.g., trophy icon
            })) || []
          }
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
