import { Test, TestingModule } from '@nestjs/testing';
import { HomeStrategy } from './home.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { PlatformSettingRepository } from '@modules/platform-settings/infrastructure/persistence/platform-setting.repository';
import { activeProgramQuery, anyProgramFallbackQuery } from '@shared/utils/active-program-resolver';

describe('HomeStrategy', () => {
    let strategy: HomeStrategy;

    const mockPrismaService = {
        program: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        programGallery: {
            findMany: jest.fn(),
        },
        sponsor: {
            findMany: jest.fn(),
        },
        brandSocialFeed: {
            findMany: jest.fn(),
        },
        programTestimonial: {
            findMany: jest.fn(),
        },
        participant: {
            count: jest.fn(),
        },
        participantApplication: {
            findMany: jest.fn(),
        },
        file: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null), // Always return null (cache miss) for tests
        set: jest.fn().mockResolvedValue(undefined),
        invalidateByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockPlatformSettingRepository = {
        get: jest.fn().mockResolvedValue(null),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HomeStrategy,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PlatformSettingRepository, useValue: mockPlatformSettingRepository },
            ],
        }).compile();

        strategy = module.get<HomeStrategy>(HomeStrategy);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    it('should return default structure if category is null', async () => {
        const result = await strategy.getData(null);
        expect(result).toMatchObject({
            slug: 'home',
            title: 'Youth Break the Boundaries',
            sections: [],
        });
    });

    it('should aggregate data into correct sections', async () => {
        const category = {
            id: 'cat-1',
            name: 'Test Brand',
            bannerUrl: 'http://banner.jpg',
            websiteUrl: 'http://brand.com',
            vision: 'Vision',
            mission: 'Mission',
            metadata: {
                participant_demographics: {
                    title: 'Seeded Data',
                    country_levels: { China: 'high' },
                    country_participants: { China: 999 },
                },
            },
        };

        // 1. Program with details (single findFirst now serves both the hero
        // section and the awards section — see home.strategy.ts Fix 2 merge)
        mockPrismaService.program.findFirst.mockResolvedValueOnce({
            id: 'prog-1',
            name: 'Main Program',
            gallery: [
                { id: 'img-1', type: 'image', imageUrl: 'img1.jpg', title: 'Img 1' },
            ],
            pricingTiers: [
                { id: 'tier-1', name: 'Basic', price: 100, currency: 'USD' },
            ],
            resources: [
                { id: 'res-1', title: 'Guide', type: 'pdf', fileUrl: 'guide.pdf' },
            ],
            objectives: [
                { id: 'obj-1', description: 'Obj 1', order: 1 },
            ],
            awards: [
                { id: 'award-1', name: 'Best Speaker', winnerCount: 1, tags: ['TOP'] }
            ]
        });

        mockPrismaService.programGallery.findMany.mockResolvedValue([
            { id: 'img-brand-1', type: 'image', imageUrl: 'img-brand-1.jpg', title: 'Brand Img 1' },
        ]);

        // 2. Sponsors
        mockPrismaService.sponsor.findMany.mockResolvedValue([
            { id: 'sp-1', name: 'Sponsor 1', logoUrl: 'logo.png', tier: 'gold' }
        ]);

        // 3. Social Feeds
        mockPrismaService.brandSocialFeed.findMany.mockResolvedValue([
            { id: 'feed-1', permalink: 'link', imageUrl: 'feed.jpg' }
        ]);

        // 4. Video Programs
        mockPrismaService.program.findMany.mockResolvedValue([
            {
                id: 'prog-video',
                name: 'Video Program',
                year: 2024,
                gallery: [
                    { id: 'vid-1', type: 'video', title: 'Recap', videoUrl: 'vid.mp4' }
                ]
            }
        ]);

        // 5. Testimonials
        mockPrismaService.programTestimonial.findMany.mockResolvedValue([
            { id: 'test-1', name: 'Alumni', testimonial: 'Great!' }
        ]);
        mockPrismaService.participantApplication.findMany.mockResolvedValue([
            { participant: { originCountry: 'ID', nationality: 'Indonesia' } },
            { participant: { originCountry: 'Indonesia', nationality: 'Indonesia' } },
            { participant: { originCountry: 'JP', nationality: 'Japan' } },
            { participant: { originCountry: null, nationality: null } },
        ]);

        const result: any = await strategy.getData(category as any);

        expect(result.title).toBe('Test Brand');
        const sections = result.sections;

        // Check Main Banner
        const banner = sections.find(s => s.type === 'main_banner');
        expect(banner).toBeDefined();
        expect(banner?.content?.title).toBe('Test Brand');

        // Check Registration Overview (Pricing, Guidelines, Social)
        const overview = sections.find(s => s.type === 'registration_overview');
        expect(overview).toBeDefined();
        expect(overview?.content?.registration_types).toHaveLength(1);
        expect(overview?.content?.guidelines).toHaveLength(1);
        expect(overview?.content?.ig_feed).toHaveLength(1);

        // Check Objectives
        const objectives = sections.find(s => s.type === 'program_objectives');
        expect(objectives).toBeDefined();
        expect(objectives?.content?.items).toHaveLength(1);

        // Check Awards (from Latest Program)
        const awards = sections.find(s => s.type === 'program_awards');
        expect(awards).toBeDefined();
        expect(awards?.content?.items).toHaveLength(1);
        expect(awards?.content?.title).toContain('Main Program');

        // Check Video Highlights
        const videos = sections.find(s => s.type === 'program_highlight_videos');
        expect(videos).toBeDefined();
        expect(videos?.content?.tabs).toHaveLength(1);
        expect(videos?.content?.tabs![0].videos).toHaveLength(1);

        // Check Sponsors
        const sponsors = sections.find(s => s.type === 'supported_by');
        expect(sponsors).toBeDefined();
        expect(sponsors?.data).toHaveLength(1);

        const demographics = sections.find(s => s.type === 'participant_demographics');
        expect(demographics).toMatchObject({
            content: {
                title: 'Participant Distribution by Country',
                country_participants: {
                    Indonesia: 2,
                    Japan: 1,
                },
                country_levels: {
                    Indonesia: 'high',
                    Japan: 'medium',
                },
            },
        });
    });

    it('reads benefits/features/promo_cta/moments_shorts/further_information/payment_info from Program.landingContent, not Brand.metadata, and impact_stats from PlatformSetting, not Brand.metadata', async () => {
        const category = {
            id: 'cat-1', name: 'Test Brand', bannerUrl: 'http://banner.jpg', websiteUrl: 'http://brand.com',
            vision: 'Vision', mission: 'Mission',
            // Brand-level metadata carries DIFFERENT values for the same keys
            // — proves the assertions below are reading Program/PlatformSetting,
            // not falling back to (or accidentally still reading) this.
            metadata: {
                benefits: { eyebrow: 'BRAND eyebrow', title: 'BRAND title', groups: [] },
                features: [{ id: 'brand-f', icon: 'x', title: 'BRAND feature', description: '' }],
                promo_cta: { title: 'BRAND promo' },
                moments_shorts: { eyebrow: 'BRAND shorts' },
                further_information: { title: 'BRAND further info' },
                payment_info: { eyebrow: 'BRAND payment', title: 'x', introText: 'x', items: [], note: 'x' },
                impact_stats: { total_alumni: 'BRAND-STALE-999' },
            },
        };

        mockPrismaService.program.findFirst.mockResolvedValueOnce({
            id: 'prog-1', name: 'Main Program',
            gallery: [], pricingTiers: [], resources: [], objectives: [], awards: [],
            landingContent: {
                benefits: { eyebrow: 'PROGRAM eyebrow', title: 'PROGRAM title', groups: [] },
                features: [{ id: 'prog-f', icon: 'y', title: 'PROGRAM feature', description: '' }],
                promo_cta: { title: 'PROGRAM promo' },
                moments_shorts: { eyebrow: 'PROGRAM shorts' },
                further_information: { title: 'PROGRAM further info' },
                payment_info: { eyebrow: 'PROGRAM payment', title: 'y', introText: 'y', items: [], note: 'y' },
            },
        });
        mockPrismaService.programGallery.findMany.mockResolvedValue([]);
        mockPrismaService.sponsor.findMany.mockResolvedValue([]);
        mockPrismaService.brandSocialFeed.findMany.mockResolvedValue([]);
        mockPrismaService.program.findMany.mockResolvedValue([]);
        mockPrismaService.programTestimonial.findMany.mockResolvedValue([]);
        mockPrismaService.participantApplication.findMany.mockResolvedValue([]);
        mockPlatformSettingRepository.get.mockResolvedValue({
            key: 'impact_stats',
            value: { total_alumni: '1700+', editions_held: '15+', total_countries: '50+', total_participants: '1700+' },
            updatedAt: new Date(), updatedBy: null,
        });

        const result: any = await strategy.getData(category as any);
        const sections = result.sections;

        expect(sections.find((s: any) => s.type === 'program_benefits')?.content.eyebrow).toBe('PROGRAM eyebrow');
        expect(sections.find((s: any) => s.type === 'program_features')?.content.items[0].title).toBe('PROGRAM feature');
        expect(sections.find((s: any) => s.type === 'program_shorts')?.content.eyebrow).toBe('PROGRAM shorts');
        expect(sections.find((s: any) => s.type === 'further_information')?.content.title).toBe('PROGRAM further info');
        expect(sections.find((s: any) => s.type === 'payment_info')?.content.eyebrow).toBe('PROGRAM payment');
        // promo_cta merges via object spread (`...programLandingContent.promo_cta`)
        // rather than reading individual named sub-fields — assert the actual
        // merge behavior instead: the spread value for a key present in the
        // patch (title) wins over the section's own default.
        expect(sections.find((s: any) => s.type === 'promo_cta')?.content.title).toBe('PROGRAM promo');

        expect(sections.find((s: any) => s.type === 'program_impact')?.content.stats).toEqual([
            { id: 'participants', label: 'Total Participants', value: '1700+', icon: 'participants' },
            { id: 'countries', label: 'Total Countries', value: '50+', icon: 'countries' },
            { id: 'alumni', label: 'Total Alumni', value: '1700+', icon: 'alumni' },
        ]);
        expect(mockPlatformSettingRepository.get).toHaveBeenCalledWith('impact_stats');
    });

    it('program_objectives renders from the real ProgramObjective relation even when Brand.metadata.program_objectives is set — the override is removed, not merely deprioritized', async () => {
        const category = {
            id: 'cat-1', name: 'Test Brand', bannerUrl: 'http://banner.jpg', websiteUrl: 'http://brand.com',
            vision: 'Vision', mission: 'Mission',
            metadata: { program_objectives: { eyebrow: 'STALE override', title: 'STALE title', items: ['Stale item'] } },
        };

        mockPrismaService.program.findFirst.mockResolvedValueOnce({
            id: 'prog-1', name: 'Main Program',
            gallery: [], pricingTiers: [], resources: [],
            objectives: [{ id: 'obj-1', description: 'Real relation objective', order: 1 }],
            awards: [],
        });
        mockPrismaService.programGallery.findMany.mockResolvedValue([]);
        mockPrismaService.sponsor.findMany.mockResolvedValue([]);
        mockPrismaService.brandSocialFeed.findMany.mockResolvedValue([]);
        mockPrismaService.program.findMany.mockResolvedValue([]);
        mockPrismaService.programTestimonial.findMany.mockResolvedValue([]);
        mockPrismaService.participantApplication.findMany.mockResolvedValue([]);

        const result: any = await strategy.getData(category as any);
        const objectives = result.sections.find((s: any) => s.type === 'program_objectives');

        expect(objectives?.content.eyebrow).toBe('Program Objective'); // hardcoded default, not 'STALE override'
        expect(objectives?.content.items).toEqual([{ id: 'obj-1', description: 'Real relation objective', order: 1 }]);
    });

    // The two real brands this whole change exists for (resolver addendum).
    // Both fail rule 1 (isPublished && isActive) and must recover via the
    // resolver's rule-2 fallback — proving the ENTIRE home page (not just
    // the landingContent-sourced sections above) resolves against the same
    // program settings.strategy.ts resolves for contact info, not `null`.
    // Before this task's deviation from its own brief (which left the
    // program.findFirst query's where/orderBy untouched), these two brands'
    // home pages would render every program-derived section empty.
    it('resolves the whole home page via rule-2 fallback for the Vietnam shape (published=true, isActive=false)', async () => {
        const category = {
            id: 'brand-vys', name: 'Vietnam Youth Summit', bannerUrl: 'http://banner.jpg', websiteUrl: 'http://brand.com',
            vision: 'Vision', mission: 'Mission', metadata: {},
        };
        const vietnamProgram = {
            id: 'p-vys', name: 'Vietnam Youth Summit 2026', isPublished: true, isActive: false,
            gallery: [], pricingTiers: [{ id: 'tier-1', name: 'Basic', price: 100, currency: 'USD' }],
            resources: [], objectives: [], awards: [],
            landingContent: { benefits: { eyebrow: 'VYS eyebrow' } },
        };
        mockPrismaService.program.findFirst
            .mockResolvedValueOnce(null) // rule 1: isPublished && isActive finds nothing
            .mockResolvedValueOnce(vietnamProgram); // rule 2: most recent non-deleted program
        mockPrismaService.programGallery.findMany.mockResolvedValue([]);
        mockPrismaService.sponsor.findMany.mockResolvedValue([]);
        mockPrismaService.brandSocialFeed.findMany.mockResolvedValue([]);
        mockPrismaService.program.findMany.mockResolvedValue([]);
        mockPrismaService.programTestimonial.findMany.mockResolvedValue([]);
        mockPrismaService.participantApplication.findMany.mockResolvedValue([]);

        const result: any = await strategy.getData(category as any);

        expect(mockPrismaService.program.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining(activeProgramQuery('brand-vys')));
        expect(mockPrismaService.program.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining(anyProgramFallbackQuery('brand-vys')));
        const overview = result.sections.find((s: any) => s.type === 'registration_overview');
        expect(overview?.content.registration_types).toHaveLength(1);
        expect(result.sections.find((s: any) => s.type === 'program_benefits')?.content.eyebrow).toBe('VYS eyebrow');
    });

    it('resolves the whole home page via rule-2 fallback for the Korea shape (isPublished=false, isActive=true)', async () => {
        const category = {
            id: 'brand-kys', name: 'Korea Youth Summit', bannerUrl: 'http://banner.jpg', websiteUrl: 'http://brand.com',
            vision: 'Vision', mission: 'Mission', metadata: {},
        };
        const koreaProgram = {
            id: 'p-kys', name: '4th Korea Youth Summit', isPublished: false, isActive: true,
            gallery: [], pricingTiers: [{ id: 'tier-1', name: 'Basic', price: 100, currency: 'USD' }],
            resources: [], objectives: [], awards: [],
            landingContent: { benefits: { eyebrow: 'KYS eyebrow' } },
        };
        mockPrismaService.program.findFirst
            .mockResolvedValueOnce(null) // rule 1: isPublished && isActive finds nothing
            .mockResolvedValueOnce(koreaProgram); // rule 2: most recent non-deleted program
        mockPrismaService.programGallery.findMany.mockResolvedValue([]);
        mockPrismaService.sponsor.findMany.mockResolvedValue([]);
        mockPrismaService.brandSocialFeed.findMany.mockResolvedValue([]);
        mockPrismaService.program.findMany.mockResolvedValue([]);
        mockPrismaService.programTestimonial.findMany.mockResolvedValue([]);
        mockPrismaService.participantApplication.findMany.mockResolvedValue([]);

        const result: any = await strategy.getData(category as any);

        expect(mockPrismaService.program.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining(activeProgramQuery('brand-kys')));
        expect(mockPrismaService.program.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining(anyProgramFallbackQuery('brand-kys')));
        const overview = result.sections.find((s: any) => s.type === 'registration_overview');
        expect(overview?.content.registration_types).toHaveLength(1);
        expect(result.sections.find((s: any) => s.type === 'program_benefits')?.content.eyebrow).toBe('KYS eyebrow');
    });
});
