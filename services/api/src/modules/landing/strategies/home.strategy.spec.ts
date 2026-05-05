import { Test, TestingModule } from '@nestjs/testing';
import { HomeStrategy } from './home.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';

describe('HomeStrategy', () => {
    let strategy: HomeStrategy;
    let prismaService: any;

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
        file: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null), // Always return null (cache miss) for tests
        set: jest.fn().mockResolvedValue(undefined),
        invalidateByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HomeStrategy,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        strategy = module.get<HomeStrategy>(HomeStrategy);
        prismaService = module.get<PrismaService>(PrismaService);

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
        };

        // 1. Program with details
        mockPrismaService.program.findFirst
            // First call: Main Program
            .mockResolvedValueOnce({
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
                ]
            })
            // Second call (in Promise.all): Latest Program for Awards
            .mockResolvedValueOnce({
                name: 'Latest Program',
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
        expect(awards?.content?.title).toContain('Latest Program');

        // Check Video Highlights
        const videos = sections.find(s => s.type === 'program_highlight_videos');
        expect(videos).toBeDefined();
        expect(videos?.content?.tabs).toHaveLength(1);
        expect(videos?.content?.tabs![0].videos).toHaveLength(1);

        // Check Sponsors
        const sponsors = sections.find(s => s.type === 'supported_by');
        expect(sponsors).toBeDefined();
        expect(sponsors?.data).toHaveLength(1);
    });
});
