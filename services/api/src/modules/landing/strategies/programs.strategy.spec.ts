import { Test, TestingModule } from '@nestjs/testing';
import { ProgramsStrategy } from './programs.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';

describe('ProgramsStrategy', () => {
    let strategy: ProgramsStrategy;

    const mockPrismaService = {
        program: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
        file: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
    };

    const mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProgramsStrategy,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        strategy = module.get<ProgramsStrategy>(ProgramsStrategy);
        jest.clearAllMocks();
        mockCacheService.get.mockResolvedValue(null);
        mockCacheService.set.mockResolvedValue(undefined);
        mockPrismaService.file.findFirst.mockResolvedValue(null);
    });

    it('uses stored schedule dates before legacy Day N fallback for program activities', async () => {
        mockPrismaService.program.findFirst.mockResolvedValue({
            id: 'program-1',
            name: 'China Youth Summit 2026',
            slug: 'china-youth-summit-2026',
            description: 'Program description',
            shortDescription: 'Program short description',
            location: 'China',
            programFormat: 'in_person',
            startDate: new Date('2026-11-09T00:00:00.000Z'),
            endDate: new Date('2026-11-12T00:00:00.000Z'),
            registrationOpenDate: null,
            registrationCloseDate: null,
            schedules: [
                {
                    id: 'schedule-1',
                    day: '2026-11-10',
                    activity: 'Breakfast',
                    description: 'Breakfast at Hotel',
                    startTime: '06:30',
                    endTime: '08:00',
                    location: null,
                    speaker: null,
                    order: 1,
                },
                {
                    id: 'schedule-2',
                    day: 'Day 3',
                    activity: 'Closing Ceremony',
                    description: 'Final session',
                    startTime: '16:30',
                    endTime: '18:00',
                    location: null,
                    speaker: null,
                    order: 2,
                },
            ],
            timeline: [],
            faqs: [],
            resources: [],
            pricingTiers: [],
            objectives: [],
            subthemes: [],
            tags: [],
        });
        mockPrismaService.program.findMany.mockResolvedValue([]);

        const result: any = await strategy.getData({
            id: 'brand-1',
            name: 'China Youth Summit',
        } as any);

        const activitiesSection = result.sections.find((section: { type: string }) => section.type === 'program_activities');

        expect(activitiesSection).toBeDefined();
        expect(activitiesSection.content.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    title: 'Breakfast',
                    date: '2026-11-10',
                }),
                expect.objectContaining({
                    title: 'Closing Ceremony',
                    date: '2026-11-11',
                }),
            ]),
        );
    });
});
