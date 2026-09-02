import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { TESTIMONIAL_CATEGORY } from '../../../shared/constants/testimonial-categories';
import { Brand } from '@prisma/client';
import {
  buildParticipantDistributionLevels,
  normalizeCountryGroups,
  resolveCountryName,
} from '@shared/utils/country-groups';
import { resolveActiveProgram } from '@shared/utils/active-program-resolver';
import { PlatformSettingRepository } from '@modules/platform-settings/infrastructure/persistence/platform-setting.repository';
import {
  buildRegistrationEditions,
  fetchOpenRegistrationPrograms,
  mapPricingTiersToRegistrationTypes,
  resolveEditionGuidebooks,
} from './registration-editions.util';

const FULLY_FUNDED_PROCESS_COPY =
  'Complete the registration fee, submit the required documents and essay, and participate in the interview process.';

// Homepage teaser size for `program_gallery`. 12 = exactly 3 full rows on the
// 4-column desktop grid; the untruncated pool stays available in `full_gallery`
// for /programs/gallery. Also caps each per-edition tab below.
const HOME_GALLERY_TEASER_LIMIT = 12;

// Decorate-sort-undecorate shuffle. Returns a new array and never mutates the
// input, so the same source pool can be shuffled independently per section.
const shuffleImages = <T>(images: readonly T[]): T[] =>
  images
    .map((img) => ({ img, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ img }) => img);

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
  text_color_scheme?: 'light' | 'dark';
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

type QuoteTestimonialRow = {
  id: string;
  name: string;
  role: string | null;
  testimonial: string;
  company: string | null;
  avatarUrl: string | null;
  alumniYear: number | null;
};

/**
 * Shared shape for the quote-style testimonial cards (delegates and speakers).
 * The alumni section uses its own video-first mapping and is intentionally
 * excluded here.
 */
function mapDelegateTestimonial(t: QuoteTestimonialRow) {
  return {
    id: t.id,
    name: t.name,
    role: t.role,
    quote: t.testimonial,
    country: t.company || '',
    photo: t.avatarUrl || '',
    year: t.alumniYear ?? null,
  };
}

@Injectable()
export class HomeStrategy implements ILandingPageStrategy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly platformSettingRepository: PlatformSettingRepository,
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

    // Shared resolver (Phase 3 resolver addendum), NOT the old
    // isPublished/isActive-only query ordered by `startDate desc`. That
    // orderBy was a second, independently-drifting definition of "the
    // active program" from settings.strategy.ts's (`year desc, createdAt
    // desc`) — flagged as a live hazard in this phase's pre-flight scan:
    // for brands with several published+active programs (Istanbul, MEYS,
    // Korea, Japan, World Youth Fest, Youth Academic Forum) the two orderings
    // are not guaranteed to agree, which would mean this page's sections and
    // the settings endpoint's contact info silently describe two different
    // programs for the same brand. Task 12's backfill already resolves once
    // per brand via this identical builder and writes both contact fields
    // and landingContent onto that one program — this call must resolve the
    // same program that write did, including via the rule-2 fallback for
    // Vietnam Youth Summit (published, inactive) and Korea Youth Summit
    // (unpublished, active), or their entire home page — not just contact
    // info — renders empty.
    const { program } = await resolveActiveProgram(
      (args) =>
        this.prisma.program.findFirst({
          ...args,
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
              // Secondary key keeps ties deterministic — duplicate `order` values
              // otherwise surface in arbitrary DB order (see MEYS IDN/ENG mixup).
              orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            },
            objectives: {
              where: { isActive: true },
              orderBy: { order: 'asc' }
            },
            // Also used by the program_awards section further below — merged here
            // to avoid a duplicate program.findFirst with the identical where/orderBy.
            awards: {
              where: { isActive: true },
              orderBy: { order: 'asc' }
            }
          },
        }),
      brand.id,
    );

    const nowForRegistrationWindow = new Date();

    const [brandImageGallery, brandSponsors, socialFeeds, videoPrograms, alumniTestimonials, delegateTestimonials, speakerTestimonials, registeredApplications, platformImpactStatsRow, openRegistrationPrograms] = await Promise.all([
      this.prisma.programGallery.findMany({
        where: {
          type: 'image',
          isActive: true,
          deletedAt: null,
          // Fetch brand-wide, then prefer the active program's own images below.
          // Scoping the query itself to resolveActiveProgram's pick left the
          // section imageless whenever the newest program had no uploads yet.
          // Korea Youth Summit 4th has zero rows while KYS 2025 has 18, so the
          // objectives collage rendered as empty frames. See
          // shared/utils/active-program-resolver.ts.
          program: { brandId: brand.id },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          title: true,
          imageUrl: true,
          type: true,
          programId: true,
          // Edition label for the per-edition gallery tabs built below, so the
          // homepage can switch between KYS 2025 / KYS 2026 / ... without a
          // second query per program.
          program: { select: { name: true, year: true } },
        },
      }),
      this.prisma.sponsor.findMany({
        where: {
          brandId: brand.id, // Scoped to brand
          isActive: true
        },
        orderBy: { order: 'asc' },
      }),
      // Fetched once for the whole brand (no take limit) so it can be grouped
      // per-edition below without an N+1 query per program. Each edition is
      // capped to IG_FEED_TAKE posts after grouping.
      this.prisma.brandSocialFeed.findMany({
        where: {
          brandId: brand.id,
          isActive: true,
          platform: 'instagram',
        },
        orderBy: { postedAt: 'desc' },
      }),
      this.prisma.program.findMany({
        where: {
          brandId: brand.id,
          isPublished: true,
          status: { not: 'draft' },
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
          category: TESTIMONIAL_CATEGORY.ALUMNI,
          isActive: true
        },
        // Videos first: this section is a video reel, and text-only alumni
        // testimonials used to eat the take window so most of a brand's videos
        // never reached the page ('type' desc puts 'video' before 'text').
        orderBy: [
          { isFeatured: 'desc' },
          { type: 'desc' },
          { order: 'asc' }
        ],
        take: 40
      }),
      this.prisma.programTestimonial.findMany({
        where: {
          brandId: brand.id,
          category: TESTIMONIAL_CATEGORY.DELEGATE,
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
          category: TESTIMONIAL_CATEGORY.SPEAKER,
          isActive: true
        },
        orderBy: [
          { isFeatured: 'desc' },
          { order: 'asc' }
        ],
        take: 10
      }),
      this.prisma.participantApplication.findMany({
        where: {
          // Count ALL registered participants for the program (any application
          // status), not only submitted — drives the public participant
          // distribution stat. deletedAt:null still excludes removed rows.
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
      this.platformSettingRepository.get('impact_stats'),
      // Every currently-relevant edition for this brand (see MEYS 6th/7th
      // concurrent-active-programs bug: two published+active programs can
      // both have open registration at once, and `program` above resolves
      // only ONE of them). Filtered on close date only — "not already
      // ended" per the bug report, not on open date, so an edition whose
      // registration hasn't opened yet still shows a (closed) card instead
      // of vanishing. Ordered soonest-close-first, nulls (no bound) last,
      // tie-broken with the same ordering active-program-resolver.ts uses
      // everywhere else so this list and `program`'s own resolution never
      // silently disagree on ties. Query + include shared with
      // programs.strategy.ts via registration-editions.util.ts.
      fetchOpenRegistrationPrograms(this.prisma, this.cacheService, brand.id, nowForRegistrationWindow),
    ]);

    // Shared with each edition's own `guidelines` in `programs[]` below (via
    // buildRegistrationEditions, which resolves guidebooks the same way).
    const guidebookResources = await resolveEditionGuidebooks(this.prisma, program?.resources ?? []);

    // Group the brand's Instagram posts by edition (programId), plus a
    // separate brand-wide bucket (programId === null) used as a fallback.
    // Both lists stay in postedAt-desc order because the query above is.
    const IG_FEED_TAKE = 6;
    const mappedSocialFeeds = socialFeeds.map(feed => ({
      id: feed.id,
      permalink: feed.permalink,
      imageUrl: feed.imageUrl,
      caption: feed.caption,
    }));
    const igFeedsByProgramId = new Map<string, typeof mappedSocialFeeds>();
    const brandWideIgFeed: typeof mappedSocialFeeds = [];
    socialFeeds.forEach((feed, index) => {
      const mapped = mappedSocialFeeds[index];
      if (feed.programId) {
        const existing = igFeedsByProgramId.get(feed.programId) ?? [];
        existing.push(mapped);
        igFeedsByProgramId.set(feed.programId, existing);
      } else {
        brandWideIgFeed.push(mapped);
      }
    });

    // Edition-specific posts when the edition has any of its own; otherwise
    // fall back to the brand-wide bucket. No mixed top-up — an edition with
    // even one post of its own shows only its own posts.
    const resolveIgFeedForProgram = (programId?: string | null) => {
      const ownPosts = programId ? igFeedsByProgramId.get(programId) : undefined;
      return (ownPosts && ownPosts.length > 0 ? ownPosts : brandWideIgFeed).slice(0, IG_FEED_TAKE);
    };

    const sectionIgFeed = resolveIgFeedForProgram(program?.id);

    // Filter out programs that don't have any videos
    const programsWithVideos = videoPrograms.filter(p => p.gallery && p.gallery.length > 0);

    // Separate gallery by type
    const shortsGallery = program?.gallery || [];

    // Prefer the active program's own images, falling back to every other
    // program in the brand so a newly created program is never left with
    // empty frames.
    const ownImages = program ? brandImageGallery.filter(img => img.programId === program.id) : [];
    const galleryPool = ownImages.length > 0 ? ownImages : brandImageGallery;

    // Shuffle image gallery once. All sections below draw from this randomised pool.
    // The shuffle ensures an unbiased random order per cache-miss (i.e. per deploy / TTL expiry).
    const imageGallery = shuffleImages(galleryPool);

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

    // Full pool (up to the 200-row take above) for the dedicated /programs/gallery
    // page. `programGallery` below stays capped at HOME_GALLERY_TEASER_LIMIT for
    // the homepage teaser (3 full rows on the 4-col desktop grid), which links
    // out to that page via `cta.url`. Additive `full_gallery` field,
    // `gallery`/`images` unchanged for backwards compatibility.
    const toGalleryImage = (img: (typeof imageGallery)[number]) => ({
      id: img.id,
      url: img.imageUrl,
      caption: img.title,
    });

    const fullProgramGallery = imageGallery.map(toGalleryImage);

    const programGallery = fullProgramGallery.slice(0, HOME_GALLERY_TEASER_LIMIT);

    // Per-edition tabs so a visitor can browse the gallery by edition (KYS 2025,
    // KYS 2026, ...) without leaving the homepage — the behaviour the old site
    // had. Shape mirrors `program_highlight_videos`' `tabs` below (year +
    // program_name + the edition's own items) so the two switchable sections
    // stay consistent. Grouped from the brand-wide pool that was already
    // fetched, so no extra query. Only editions that actually have images get a
    // tab: an empty tab is worse than no tab. Additive — `gallery`, `images`
    // and `full_gallery` are untouched, so a payload cached before this change
    // still renders.
    const galleryImagesByProgramId = new Map<string, typeof brandImageGallery>();
    brandImageGallery.forEach((img) => {
      const existing = galleryImagesByProgramId.get(img.programId) ?? [];
      existing.push(img);
      galleryImagesByProgramId.set(img.programId, existing);
    });
    const galleryEditionTabs = Array.from(galleryImagesByProgramId.entries())
      .map(([programId, images]) => ({
        program_id: programId,
        program_name: images[0].program?.name ?? '',
        year: images[0].program?.year ?? null,
        // The active edition is the default tab, preserving the pre-tabs
        // behaviour where the teaser showed only the active program's images.
        // When it has none it simply gets no tab and the frontend falls back to
        // the newest edition, matching the brand-wide fallback above.
        is_active: programId === program?.id,
        gallery: shuffleImages(images).slice(0, HOME_GALLERY_TEASER_LIMIT).map(toGalleryImage),
      }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

    // Program-owned landing sections (Task 1's Program.landingContent), not
    // Brand.metadata, as of Phase 3's ownership split — see
    // docs/superpowers/specs/2026-08-23-program-content-copy-design.md,
    // "Brand and program ownership split". section_background stays reading
    // brandMeta below: it is explicitly Brand-owned ("global across landing
    // sections" per its own original comment) and unaffected by this switch.
    const programLandingContent = (program?.landingContent as Record<string, unknown>) ?? {};
    const furtherInformationMeta = normalizeFurtherInformationContent(programLandingContent.further_information);
    const globalBg = (brandMeta.section_background as SectionBackgroundMetadata | undefined);
    // Resolve background URLs: global section_background → legacy per-section fields → undefined (no image)
    const sectionBgDesktop =
      globalBg?.desktop_url ||
      furtherInformationMeta?.background_image_url ||
      undefined;
    const sectionBgMobile =
      globalBg?.mobile_url ||
      furtherInformationMeta?.background_image_mobile_url ||
      undefined;
    const sectionTextColorScheme = globalBg?.text_color_scheme || 'dark';
    const fallbackObjectiveItems = (program?.objectives ?? []).map((obj) => ({
      id: obj.id,
      description: obj.description,
      order: obj.order,
    }));

    const participantCountryGroups = normalizeCountryGroups(
      registeredApplications.map((application) => ({
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

    // Additive `programs` array for the registration_overview section (see
    // MEYS 6th/7th bug above). Built by the shared editions helper (same one
    // programs.strategy.ts's `registration_info` section uses), plus
    // `ig_feed` appended here per-edition: each edition gets its own
    // BrandSocialFeed posts (programId match) when it has any, falling back
    // to the brand-wide bucket (programId === null) otherwise — see
    // resolveIgFeedForProgram above.
    const registrationEditions = (
      await buildRegistrationEditions(this.prisma, openRegistrationPrograms, nowForRegistrationWindow)
    ).map((edition) => ({ ...edition, ig_feed: resolveIgFeedForProgram(edition.program_id) }));

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
            ig_feed: sectionIgFeed,
            registration_types: mapPricingTiersToRegistrationTypes(program?.pricingTiers),
            guidelines: guidebookResources,
            // Additive: every currently-relevant edition, soonest-close-first.
            // The fields above stay driven by `program` (resolveActiveProgram's
            // pick) exactly as before — untouched, so a brand with one open
            // program renders identically. `programs[0]` and `program` are the
            // same program for every brand with a single open edition; they can
            // only diverge for a brand resolveActiveProgram had to fall back
            // for (published+inactive or unpublished+active), which this
            // stricter list correctly excludes rather than fabricating a card
            // for registration that was never actually open.
            programs: registrationEditions,
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
            background_image_url: sectionBgDesktop,
          },
        },
        {
          type: 'program_objectives',
          content: {
            // No metadata override any more — objectives have exactly one
            // owner, the ProgramObjective relation (fallbackObjectiveItems).
            // The spec's audit confirmed no production brand had a
            // program_objectives override set, so this is a zero-behavior-
            // change removal, not a data-loss risk.
            eyebrow: 'Program Objective',
            title: 'Program Objectives',
            intro: `The ${brand.name} program is carefully designed to shape delegates into impactful young leaders. Through a mix of forums, competitions, and collaborative projects, participants are guided to grow in character, skills, and global perspective.`,
            items: fallbackObjectiveItems,
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
          content: normalizePaymentInfoContent(programLandingContent.payment_info) || {
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
            // Untruncated pool for the full /programs/gallery page.
            full_gallery: fullProgramGallery,
            // Per-edition tabs; same shape as program_highlight_videos' `tabs`.
            tabs: galleryEditionTabs,
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
            eyebrow: (programLandingContent.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.eyebrow || 'Short Highlights',
            title: (programLandingContent.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.title || 'Discover Our Moments in 60 Seconds',
            description: (programLandingContent.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.description || `Watch bite-sized highlights from ${brand.name}'s workshops and cultural sessions.`,
            background_image_url: sectionBgDesktop,
            text_color_scheme: sectionTextColorScheme,
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
            // Platform-wide, not brand-scoped — see Task 3/12. Was
            // brandMeta.impact_stats (byte-identical across three brands,
            // i.e. already a de-facto platform value that had merely been
            // triplicated); now a single PlatformSetting row every brand reads.
            stats: platformImpactStatsRow?.value
              ? [
                  { id: 'participants', label: 'Total Participants', value: (platformImpactStatsRow.value as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown }).total_participants, icon: 'participants' },
                  { id: 'countries', label: 'Total Countries', value: (platformImpactStatsRow.value as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown }).total_countries, icon: 'countries' },
                  { id: 'alumni', label: 'Total Alumni', value: (platformImpactStatsRow.value as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown }).total_alumni, icon: 'alumni' },
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
            items: ((programLandingContent['features'] || []) as Array<{ id?: unknown; icon?: unknown; title?: unknown; description?: unknown }>).map((f) => ({
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
            ...(programLandingContent.benefits || {
              eyebrow: 'Program Benefits',
              title: 'Built for Students, University Students & Professionals',
              groups: [],
            }),
            background_image_url: sectionBgDesktop,
            background_image_mobile_url: sectionBgMobile,
            text_color_scheme: sectionTextColorScheme,
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
              is_featured: t.isFeatured,
              alumni_year: t.alumniYear ?? null,
            }))
          }
        },
        {
          type: 'delegate_testimonials',
          content: {
            items: delegateTestimonials.map(mapDelegateTestimonial),
            // Speakers ride in the same section so the frontend can tab between
            // them; kept as a separate key rather than merged into `items` so
            // the delegate list stays the section's default view.
            speakers: speakerTestimonials.map(mapDelegateTestimonial),
          },
        },
        {
          type: 'program_awards',
          content: {
            title: `Awards at ${program?.name || brand.name}`,
            subtitle: `At ${brand.name}, we recognize delegates who lead, speak up, and make an impact. Your journey could be celebrated here.`,
            items: program?.awards.map(a => ({
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
            text_color_scheme: sectionTextColorScheme,
            // No default. This used to fall back to '/img/mockupjapan.png',
            // so every brand without an uploaded mockup showed a Japan Youth
            // Summit guideline poster — Korea Youth Summit's landing page was
            // advertising JYS. Better an empty frame than another brand's
            // artwork; the frontend omits the mockup entirely when unset.
            mockup_image_url: furtherInformationMeta?.mockup_image_url || undefined,
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
            ...((programLandingContent.promo_cta as Record<string, unknown>) || {}),
            background_image_url: sectionBgDesktop,
            background_image_mobile_url: sectionBgMobile,
            text_color_scheme: sectionTextColorScheme,
            video_url: (programLandingContent.promo_cta as { video_url?: string } | undefined)?.video_url || program?.videoUrl || null,
            video_title: (programLandingContent.promo_cta as { video_title?: string } | undefined)?.video_title || (program ? `${program.name} Registration Guideline` : null),
            video_description: (programLandingContent.promo_cta as { video_description?: string } | undefined)?.video_description || null,
          },
        },
      ],
    };

    // Cache the result for 1 hour
    await this.cacheService.set(cacheKey, result, CACHE_TTL.HOUR);

    return result;
  }
}
