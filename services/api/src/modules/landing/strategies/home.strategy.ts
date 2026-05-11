import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';
import { resolveMaskedFileUrl } from '@shared/utils/masked-file-url';
import {
  buildParticipantDistributionLevels,
  normalizeCountryGroups,
  resolveCountryName,
} from '@shared/utils/country-groups';

const FULLY_FUNDED_PROCESS_COPY =
  'Complete the registration fee, submit the required documents and essay, and participate in the interview process.';

type ProgramObjectivesMetadata = {
  eyebrow?: string;
  title?: string;
  intro?: string;
  items?: string[];
};

type FurtherInformationMetadata = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** @deprecated Use section_background instead */
  background_image_url?: string;
  /** @deprecated Use section_background instead */
  background_image_mobile_url?: string;
  mockup_image_url?: string;
};

type SectionBackgroundMetadata = {
  desktop_url?: string;
  mobile_url?: string;
};

function normalizePaymentInfoContent(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const paymentInfo = value as Record<string, unknown>;
  const items = Array.isArray(paymentInfo.items) ? paymentInfo.items : null;
  if (!items) {
    return paymentInfo;
  }

  return {
    ...paymentInfo,
    items: items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return item;
      }

      const paymentItem = item as Record<string, unknown>;
      const id = typeof paymentItem.id === 'string' ? paymentItem.id.trim().toLowerCase() : '';
      const title = typeof paymentItem.title === 'string' ? paymentItem.title.trim().toLowerCase() : '';

      if (id === 'fully-funded-process' || title === 'fully funded process') {
        return { ...paymentItem, body: FULLY_FUNDED_PROCESS_COPY };
      }

      return paymentItem;
    }),
  };
}

function normalizeFurtherInformationContent(value: unknown): FurtherInformationMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const content = value as Record<string, unknown>;
  return {
    eyebrow: typeof content.eyebrow === 'string' ? content.eyebrow : undefined,
    title: typeof content.title === 'string' ? content.title : undefined,
    subtitle: typeof content.subtitle === 'string' ? content.subtitle : undefined,
    background_image_url:
      typeof content.background_image_url === 'string' ? content.background_image_url : undefined,
    background_image_mobile_url:
      typeof content.background_image_mobile_url === 'string'
        ? content.background_image_mobile_url
        : undefined,
    mockup_image_url: typeof content.mockup_image_url === 'string' ? content.mockup_image_url : undefined,
  };
}

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

    const [program, brandImageGallery, brandSponsors, socialFeeds, videoPrograms, alumniTestimonials, delegateTestimonials, latestProgramWithAwards, submittedApplications] = await Promise.all([
      this.prisma.program.findFirst({
        where: {
          brandId: brand.id, // Scoped to brand
          isPublished: true,
          isActive: true,
        },
        orderBy: { startDate: 'desc' },
        include: {
          gallery: {
            where: { isActive: true, deletedAt: null, type: 'short' },
            take: 30,
            orderBy: { order: 'asc' },
          },
          pricingTiers: {
            where: { isActive: true, deletedAt: null },
            orderBy: { order: 'asc' },
            include: {
              validityPeriods: {
                orderBy: { startDate: 'asc' },
              },
            },
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
      this.prisma.programGallery.findMany({
        where: {
          type: 'image',
          isActive: true,
          deletedAt: null,
          program: {
            brandId: brand.id,
            isPublished: true,
            isActive: true,
          },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        take: 60,
        select: {
          id: true,
          title: true,
          imageUrl: true,
          type: true,
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
          isActive: true,
          platform: 'instagram',
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
            where: { type: 'video', isActive: true, deletedAt: null },
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
      }),
      this.prisma.participantApplication.findMany({
        where: {
          submittedAt: { not: null },
          deletedAt: null,
          program: {
            brandId: brand.id,
            isPublished: true,
            deletedAt: null,
          },
          participant: {
            deletedAt: null,
          },
        },
        select: {
          participant: {
            select: {
              originCountry: true,
              nationality: true,
            },
          },
        },
      }),
    ]);

    const guidebookResources = await Promise.all(
      (program?.resources ?? []).map(async (resource) => ({
        ...resource,
        resolvedUrl: await resolveMaskedFileUrl(this.prisma, resource.fileUrl),
      })),
    );
    const guidebookUrlById = new Map(guidebookResources.map((resource) => [resource.id, resource.resolvedUrl]));

    // Filter out programs that don't have any videos
    const programsWithVideos = videoPrograms.filter(p => p.gallery && p.gallery.length > 0);

    // Separate gallery by type
    const shortsGallery = program?.gallery || [];

    // Shuffle image gallery once — all sections below draw from this randomised pool.
    // Fisher-Yates shuffle ensures an unbiased random order per cache-miss (i.e. per deploy / TTL expiry).
    const imageGallery = brandImageGallery
      .map(img => ({ img, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ img }) => img);

    // 4 images for the objectives collage
    const objectiveImages = imageGallery.slice(0, 4).map(img => ({
      url: img.imageUrl,
      caption: img.title,
    }));

    const highlightGallery = imageGallery.map((img) => ({
      url: img.imageUrl,
      caption: img.title,
      type: img.type,
    }));

    const programGallery = imageGallery.slice(0, 6).map((img) => ({
      id: img.id,
      url: img.imageUrl,
      caption: img.title,
    }));

    const objectivesMeta = (brandMeta.program_objectives as ProgramObjectivesMetadata | undefined) ?? {};
    const furtherInformationMeta = normalizeFurtherInformationContent(brandMeta.further_information);
    const globalBg = (brandMeta.section_background as SectionBackgroundMetadata | undefined);
    // Resolve background URLs: global setting → legacy per-section fields → static fallbacks
    const sectionBgDesktop =
      globalBg?.desktop_url ||
      furtherInformationMeta?.background_image_url ||
      '/img/halfback.png';
    const sectionBgMobile =
      globalBg?.mobile_url ||
      furtherInformationMeta?.background_image_mobile_url ||
      '/img/backgroundformobile.png';
    const fallbackObjectiveItems = (program?.objectives ?? []).map((obj) => ({
      id: obj.id,
      description: obj.description,
      order: obj.order,
    }));
    const objectiveItemsFromMetadata = (objectivesMeta.items ?? [])
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
      .map((description, index) => ({
        id: `meta-objective-${index + 1}`,
        description,
        order: index + 1,
      }));

    const participantCountryGroups = normalizeCountryGroups(
      submittedApplications.map((application) => ({
        country: resolveCountryName(
          application.participant.originCountry,
          application.participant.nationality,
        ),
        count: 1,
      })),
    );
    const countryParticipants = Object.fromEntries(
      participantCountryGroups.map(({ country, count }) => [country, count]),
    );
    const countryLevels = buildParticipantDistributionLevels(countryParticipants);

    const result = {
      slug: 'home',
      title: brand.name,
      sections: [
        {
          type: 'main_banner',
          content: {
            imageUrl: program?.bannerUrl || brand.bannerUrl || '',
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
              description: tier.description,
              price: tier.price,
              currency: tier.currency,
              fee_type: tier.feeType,
              allowed_categories: tier.allowedCategories,
              benefits: tier.benefits,
              requirements: tier.requirements,
              validity_periods: tier.validityPeriods?.map((vp) => ({
                start_date: vp.startDate,
                end_date: vp.endDate,
              })) ?? [],
            })) || [],
            guidelines: program?.resources.map((res) => ({
              id: res.id,
              title: res.title,
              type: res.type,
              url: guidebookUrlById.get(res.id) ?? res.fileUrl,
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
            eyebrow: (objectivesMeta.eyebrow || '').trim() || 'Program Objective',
            title: (objectivesMeta.title || '').trim() || 'Program Objectives',
            intro:
              (objectivesMeta.intro || '').trim() ||
              `The ${brand.name} program is carefully designed to shape delegates into impactful young leaders. Through a mix of forums, competitions, and collaborative projects, participants are guided to grow in character, skills, and global perspective.`,
            items: objectiveItemsFromMetadata.length > 0 ? objectiveItemsFromMetadata : fallbackObjectiveItems,
            // `gallery` is canonical; keep `images` for backwards compatibility.
            gallery: objectiveImages,
            images: objectiveImages,
          }
        },
        {
          type: 'program_highlights',
          content: {
            // `gallery` is canonical; keep `image_gallery` for backwards compatibility.
            gallery: highlightGallery,
            image_gallery: highlightGallery,
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
          content: normalizePaymentInfoContent(brandMeta.payment_info) || {
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
            // `gallery` is canonical; keep `images` for backwards compatibility.
            gallery: programGallery,
            images: programGallery,
            cta: {
              label: 'See More',
              url: '/programs/gallery',
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
            background_image_url: sectionBgDesktop,
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
          content: {
            ...(brandMeta.benefits || {
              eyebrow: 'Program Benefits',
              title: 'Built for Students, University Students & Professionals',
              groups: [],
            }),
            background_image_url: sectionBgDesktop,
            background_image_mobile_url: sectionBgMobile,
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
          content: {
            eyebrow: 'Participant Geography',
            title: 'Participant Distribution by Country',
            country_levels: countryLevels,
            country_participants: countryParticipants,
            legend: {
              high: 'High participation',
              medium: 'Medium participation',
              low: 'Low participation',
              none: 'No participants',
            },
          },
        },
        {
          type: 'further_information',
          content: {
            eyebrow: furtherInformationMeta?.eyebrow || 'Guideline',
            title: furtherInformationMeta?.title || 'Further Information',
            subtitle:
              furtherInformationMeta?.subtitle ||
              'The complete information regarding this program can be seen in the guideline below.',
            background_image_url: sectionBgDesktop,
            background_image_mobile_url: sectionBgMobile,
            mockup_image_url: furtherInformationMeta?.mockup_image_url || '/img/mockupjapan.png',
          },
        },
        {
          type: 'promo_cta',
          content: {
            eyebrow: 'Ready to Innovate?',
            title: `Ready to Innovate? Join ${brand.name} Now!`,
            subtitle: 'Be part of a global community of young leaders and innovators who are creating real impact through international programs.',
            primary_cta_label: 'Apply Now',
            primary_cta_href: '/apply',
            ...((brandMeta.promo_cta as Record<string, unknown>) || {}),
            background_image_url: sectionBgDesktop,
            background_image_mobile_url: sectionBgMobile,
            video_url: (brandMeta.promo_cta as { video_url?: string } | undefined)?.video_url || program?.videoUrl || null,
            video_title: (brandMeta.promo_cta as { video_title?: string } | undefined)?.video_title || (program ? `${program.name} Registration Guideline` : null),
            video_description: (brandMeta.promo_cta as { video_description?: string } | undefined)?.video_description || null,
          },
        },
      ],
    };

    // Cache the result for 1 hour
    await this.cacheService.set(cacheKey, result, CACHE_TTL.HOUR);

    return result;
  }
}
