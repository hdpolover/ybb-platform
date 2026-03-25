import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';

@Injectable()
export class HomeStrategy implements ILandingPageStrategy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) { }

  async getData(brand: Brand | null) {
    if (!brand) {
      // Return default or throw? returning empty structure for now
      return {
        slug: 'home',
        title: 'Youth Break the Boundaries', // Default fallback
        sections: [],
      };
    }

    // Check cache first
    const cacheKey = CACHE_KEYS.LANDING_HOME(brand.id);
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from database

    const brandMeta = (brand as Brand & { metadata?: Record<string, unknown> }).metadata || {};

    const [program, brandSponsors, socialFeeds, videoPrograms, alumniTestimonials, delegateTestimonials, latestProgramWithAwards] = await Promise.all([
      this.prisma.program.findFirst({
        where: {
          brandId: brand.id, // Scoped to brand
          isPublished: true,
          isActive: true,
        },
        orderBy: { startDate: 'asc' },
        include: {
          gallery: {
            where: { isActive: true },
            take: 30,
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
          objectives: {
            where: { isActive: true },
            orderBy: { order: 'asc' }
          }
        },
      }),
      this.prisma.sponsor.findMany({
        where: {
          brandId: brand.id, // Scoped to brand
          isActive: true
        },
        orderBy: { order: 'asc' },
      }),
      this.prisma.brandSocialFeed.findMany({
        where: {
          brandId: brand.id,
          isActive: true
        },
        orderBy: { postedAt: 'desc' },
        take: 6
      }),
      this.prisma.program.findMany({
        where: {
          brandId: brand.id,
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
          brandId: brand.id,
          category: 'alumni',
          isActive: true
        },
        orderBy: [
          { isFeatured: 'desc' },
          { order: 'asc' }
        ],
        take: 10
      }),
      this.prisma.programTestimonial.findMany({
        where: {
          brandId: brand.id,
          category: 'delegate',
          isActive: true
        },
        orderBy: [
          { isFeatured: 'desc' },
          { order: 'asc' }
        ],
        take: 10
      }),
      // For Awards - Fetch the latest published program and its awards
      this.prisma.program.findFirst({
        where: {
          brandId: brand.id,
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

    // Separate gallery by type
    const allGallery = program?.gallery || [];
    const imageGallery = allGallery.filter(g => g.type === 'image');
    const shortsGallery = allGallery.filter(g => g.type === 'short');

    // Get images for objectives (random 4 from image gallery)
    const objectiveImages = imageGallery
      .sort(() => 0.5 - Math.random())
      .slice(0, 4)
      .map(img => ({
        url: img.imageUrl,
        caption: img.title
      }));

    const result = {
      slug: 'home',
      title: brand.name,
      sections: [
        {
          type: 'main_banner',
          content: {
            imageUrl: brand.bannerUrl || '',
            link: brand.websiteUrl || '',
            title: brand.name || '',
            subtitle: brand.description || '',
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
            about_us: brand.about || '',
            vision_mission: {
              vision: brand.vision || '',
              mission: brand.mission || '',
            },
          },
        },
        {
          type: 'program_objectives',
          content: {
            title: 'Program Objectives',
            items: program?.objectives?.map((obj) => ({
              id: obj.id,
              description: obj.description,
              order: obj.order
            })) || [],
            images: objectiveImages
          }
        },
        {
          type: 'program_highlights',
          content: {
            image_gallery: imageGallery.map((img) => ({
              url: img.imageUrl,
              caption: img.title,
              type: img.type,
            })),
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
          type: 'payment_info',
          content: brandMeta.payment_info || {
            eyebrow: 'Payment & Selection',
            title: 'Important information before you apply',
            introText: 'Understand how the payment schedule and fully funded selection work so you can choose the best registration type for you.',
            items: [],
            note: 'For payment queries contact our support team.',
          },
        },
        {
          type: 'program_gallery',
          content: {
            title: 'Our Gallery',
            description: 'See the excitement and best moments from our previous programs.',
            images: imageGallery.slice(0, 6).map((img) => ({
              id: img.id,
              url: img.imageUrl,
              caption: img.title,
            })),
            cta: {
              label: 'See More',
              url: '/gallery',
            },
          },
        },
        {
          type: 'program_highlight_videos',
          content: {
            title: 'Experience Our Program in Action',
            subtitle: `Watch the journey of ${brand.name} delegates – from keynote sessions and cultural experiences to collaboration and real impact projects.`,
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
          type: 'program_shorts',
          content: {
            eyebrow: (brandMeta.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.eyebrow || 'Short Highlights',
            title: (brandMeta.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.title || 'Discover Our Moments in 60 Seconds',
            description: (brandMeta.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.description || `Watch bite-sized highlights from ${brand.name}'s workshops and cultural sessions.`,
            items: shortsGallery.map(s => ({
              id: s.id,
              title: s.title,
              embed_url: s.videoUrl,
            })),
          },
        },
        {
          type: 'program_impact',
          content: {
            eyebrow: 'Global Reach',
            title: 'Global Program Impact',
            stats: brandMeta.impact_stats
              ? [
                  { id: 'participants', label: 'Total Participants', value: (brandMeta.impact_stats as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown } | undefined)?.total_participants, icon: 'participants' },
                  { id: 'countries', label: 'Total Countries', value: (brandMeta.impact_stats as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown } | undefined)?.total_countries, icon: 'countries' },
                  { id: 'alumni', label: 'Total Alumni', value: (brandMeta.impact_stats as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown } | undefined)?.total_alumni, icon: 'alumni' },
                ]
              : [],
          },
        },
        {
          type: 'program_features',
          content: {
            eyebrow: 'What Sets Us Apart',
            title: `What Makes ${brand.name} Special`,
            subtitle: `Discover the pillars that make ${brand.name} a truly transformative leadership experience.`,
            items: ((brandMeta['features'] || []) as Array<{ id?: unknown; icon?: unknown; title?: unknown; description?: unknown }>).map((f) => ({
              id: f.id,
              icon: f.icon,
              title: f.title,
              description: f.description,
            })),
          },
        },
        {
          type: 'program_benefits',
          content: brandMeta.benefits || {
            eyebrow: 'Program Benefits',
            title: 'Built for Students, University Students & Professionals',
            groups: [],
          },
        },
        {
          type: 'alumni_stories',
          content: {
            title: 'What our Alumni says...',
            subtitle: 'MORE ALUMNI MOMENTS',
            items: alumniTestimonials.map(t => ({
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
          type: 'delegate_testimonials',
          content: {
            items: delegateTestimonials.map(t => ({
              id: t.id,
              name: t.name,
              role: t.role,
              quote: t.testimonial,
              country: t.company || '',
              photo: t.avatarUrl || '',
              year: new Date(t.createdAt).getFullYear(),
            })),
          },
        },
        {
          type: 'program_awards',
          content: {
            title: `Awards at ${latestProgramWithAwards?.name || brand.name}`,
            subtitle: `At ${brand.name}, we recognize delegates who lead, speak up, and make an impact. Your journey could be celebrated here.`,
            items: latestProgramWithAwards?.awards.map(a => ({
              id: a.id,
              name: a.name,
              description: a.description,
              winner_count: a.winnerCount,
              tags: a.tags,
              color: a.color,
              icon_url: a.iconUrl
            })) || []
          }
        },
        {
          type: 'organization_credentials',
          content: brandMeta.recognition || {
            title: 'Recognition & Credibility',
            subtitle: 'Proof that our program and organization are legitimate and credible.',
            proofs: [],
            trademark: null,
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
        {
          type: 'participant_demographics',
          content: brandMeta.participant_demographics || {
            eyebrow: 'Participant Geography',
            title: 'Participant Distribution by Country',
            country_levels: {},
            country_participants: {},
            legend: {
              high: 'High participation',
              medium: 'Medium participation',
              low: 'Low participation',
              none: 'No participants',
            },
          },
        },
        {
          type: 'promo_cta',
          content: brandMeta.promo_cta || {
            eyebrow: 'Ready to Innovate?',
            title: `Ready to Innovate? Join ${brand.name} Now!`,
            subtitle: 'Be part of a global community of young leaders and innovators who are creating real impact through international programs.',
            primary_cta_label: 'Apply Now',
            primary_cta_href: '/apply',
            video_url: program?.videoUrl || null,
            video_title: program ? `${program.name} Registration Guideline` : null,
            video_description: null,
          },
        },
      ],
    };

    // Cache the result for 1 hour
    await this.cacheService.set(cacheKey, result, CACHE_TTL.HOUR);

    return result;
  }
}
