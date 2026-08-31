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

    it('adds a `programs` edition array to registration_info, mirroring home.strategy.ts\'s shape, without changing the existing single-program fields', async () => {
        mockPrismaService.program.findFirst.mockResolvedValue({
            id: 'program-7th',
            name: 'MEYS 7th',
            slug: 'meys-7th',
            description: 'Program description',
            shortDescription: 'Program short description',
            location: 'Turkey',
            programFormat: 'in_person',
            startDate: new Date('2027-03-01T00:00:00.000Z'),
            endDate: new Date('2027-03-05T00:00:00.000Z'),
            isActive: true,
            allowRegistration: true,
            registrationOpenDate: new Date('2026-06-01T00:00:00.000Z'),
            registrationCloseDate: new Date('2027-03-20T00:00:00.000Z'),
            schedules: [],
            timeline: [],
            faqs: [],
            resources: [],
            pricingTiers: [],
            objectives: [],
            subthemes: [],
            tags: [],
        });

        // Distinguish the new editions findMany (include.pricingTiers) from
        // the pre-existing previous/other/additional-programs findMany calls
        // (select-only) sharing the same jest mock.
        mockPrismaService.program.findMany.mockImplementation((args: any) => {
            if (args?.include?.pricingTiers) {
                return Promise.resolve([
                    {
                        id: 'program-6th',
                        name: 'MEYS 6th',
                        slug: 'meys-6th',
                        year: 2026,
                        isActive: true,
                        registrationOpenDate: new Date('2026-01-01T00:00:00.000Z'),
                        registrationCloseDate: new Date('2026-11-30T00:00:00.000Z'),
                        pricingTiers: [],
                        resources: [],
                    },
                    {
                        id: 'program-7th',
                        name: 'MEYS 7th',
                        slug: 'meys-7th',
                        year: 2027,
                        isActive: true,
                        registrationOpenDate: new Date('2026-06-01T00:00:00.000Z'),
                        registrationCloseDate: new Date('2027-03-20T00:00:00.000Z'),
                        pricingTiers: [],
                        resources: [],
                    },
                ]);
            }
            return Promise.resolve([]);
        });

        const result: any = await strategy.getData({
            id: 'brand-1',
            name: 'Middle East Youth Summit',
        } as any);

        const registrationInfoSection = result.sections.find(
            (section: { type: string }) => section.type === 'registration_info',
        );

        expect(registrationInfoSection).toBeDefined();
        // Existing single-program fields stay driven by currentProgram (7th), unchanged.
        expect(registrationInfoSection.content.status).toBe('open');
        expect(registrationInfoSection.content.registration_dates).toEqual({
            open: '2026-06-01T00:00:00.000Z',
            close: '2027-03-20T00:00:00.000Z',
        });
        // New additive `programs` array carries both editions, soonest-close-first.
        expect(registrationInfoSection.content.programs).toEqual([
            expect.objectContaining({ program_id: 'program-6th', program_name: 'MEYS 6th', year: 2026, status: 'open' }),
            expect.objectContaining({ program_id: 'program-7th', program_name: 'MEYS 7th', year: 2027, status: 'open' }),
        ]);
    });

    it('includes structured start_date/end_date on program_important_dates items', async () => {
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
            schedules: [],
            timeline: [
                {
                    id: 'timeline-1',
                    title: 'Registration Opens',
                    description: 'Applications open',
                    date: new Date('2026-08-01T00:00:00.000Z'),
                    endDate: null,
                    order: 1,
                },
                {
                    id: 'timeline-2',
                    title: 'Program Days',
                    description: 'The main event',
                    date: new Date('2026-11-09T00:00:00.000Z'),
                    endDate: new Date('2026-11-12T00:00:00.000Z'),
                    order: 2,
                },
            ],
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

        const datesSection = result.sections.find(
            (section: { type: string }) => section.type === 'program_important_dates',
        );

        expect(datesSection).toBeDefined();
        expect(datesSection.content.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Registration Opens',
                    start_date: '2026-08-01T00:00:00.000Z',
                    end_date: null,
                }),
                expect.objectContaining({
                    name: 'Program Days',
                    start_date: '2026-11-09T00:00:00.000Z',
                    end_date: '2026-11-12T00:00:00.000Z',
                }),
            ]),
        );
    });

    // MEYS 6th/7th concurrent-active-programs bug: hero/overview/activities/
    // schedules/FAQs must follow the SAME edition the registration tabs show,
    // not always the newest-by-year program.
    describe('edition resolution (currentProgram follows the `edition` param)', () => {
        const twoOpenEditions = [
            {
                id: 'program-6th',
                name: 'MEYS 6th',
                slug: 'meys-6th',
                year: 2026,
                isActive: true,
                registrationOpenDate: new Date('2026-01-01T00:00:00.000Z'),
                registrationCloseDate: new Date('2026-11-30T00:00:00.000Z'), // closes SOONER
                pricingTiers: [],
                resources: [],
            },
            {
                id: 'program-7th',
                name: 'MEYS 7th',
                slug: 'meys-7th',
                year: 2027,
                isActive: true,
                registrationOpenDate: new Date('2026-06-01T00:00:00.000Z'),
                registrationCloseDate: new Date('2027-03-20T00:00:00.000Z'), // newest by year
                pricingTiers: [],
                resources: [],
            },
        ];

        const baseProgramFields = {
            description: '',
            shortDescription: '',
            location: 'Turkey',
            programFormat: 'in_person',
            isActive: true,
            allowRegistration: true,
            schedules: [],
            timeline: [],
            faqs: [],
            resources: [],
            pricingTiers: [],
            objectives: [],
            subthemes: [],
            tags: [],
        };

        function mockEditionsAndPrograms() {
            mockPrismaService.program.findMany.mockImplementation((args: any) => {
                if (args?.include?.pricingTiers) {
                    return Promise.resolve(twoOpenEditions);
                }
                return Promise.resolve([]);
            });

            // Returns the program matching the requested `where.id` so tests
            // can assert which edition was actually fetched, mirroring a real
            // findFirst({ where: { id } }).
            mockPrismaService.program.findFirst.mockImplementation((args: any) => {
                const requestedId = args?.where?.id ?? 'program-7th'; // legacy path targets newest
                const edition = twoOpenEditions.find((e) => e.id === requestedId) ?? twoOpenEditions[1];
                return Promise.resolve({
                    ...baseProgramFields,
                    id: edition.id,
                    name: edition.name,
                    slug: edition.slug,
                    startDate: edition.registrationOpenDate,
                    endDate: edition.registrationCloseDate,
                    registrationOpenDate: edition.registrationOpenDate,
                    registrationCloseDate: edition.registrationCloseDate,
                });
            });
        }

        const heroTitle = (result: any) =>
            result.sections.find((s: { type: string }) => s.type === 'hero').content.title;

        it('renders the requested edition when `edition` matches a currently-relevant program slug', async () => {
            mockEditionsAndPrograms();

            const result: any = await strategy.getData(
                { id: 'brand-1', name: 'MEYS' } as any,
                'meys-7th',
            );

            expect(heroTitle(result)).toBe('MEYS 7th');
        });

        it('falls back to the default edition when `edition` does not match any currently-relevant program', async () => {
            mockEditionsAndPrograms();

            const result: any = await strategy.getData(
                { id: 'brand-1', name: 'MEYS' } as any,
                'not-a-real-slug',
            );

            // Default = running edition with the closest deadline = 6th, not
            // the newest-by-year 7th.
            expect(heroTitle(result)).toBe('MEYS 6th');
        });

        it('picks the running edition with the closest deadline when no `edition` is given', async () => {
            mockEditionsAndPrograms();

            const result: any = await strategy.getData({ id: 'brand-1', name: 'MEYS' } as any);

            expect(heroTitle(result)).toBe('MEYS 6th');
        });

        it('falls back to newest-by-year when the brand has no currently-open editions', async () => {
            mockPrismaService.program.findMany.mockResolvedValue([]);
            mockPrismaService.program.findFirst.mockResolvedValue({
                ...baseProgramFields,
                id: 'program-only',
                name: 'Only Program',
                slug: 'only-program',
                startDate: new Date('2025-01-01T00:00:00.000Z'),
                endDate: new Date('2025-01-05T00:00:00.000Z'),
                registrationOpenDate: null,
                registrationCloseDate: null,
            });

            const result: any = await strategy.getData(
                { id: 'brand-1', name: 'MEYS' } as any,
                'meys-7th', // no editions exist at all, so this is ignored
            );

            expect(heroTitle(result)).toBe('Only Program');
            const firstCallWhere = mockPrismaService.program.findFirst.mock.calls[0][0].where;
            expect(firstCallWhere).not.toHaveProperty('id');
        });

        // Live incident: MEYS 7th was is_published=true/is_active=true but
        // status='draft', and because it has the latest start date it won
        // the newest-by-year orderBy, serving a draft program publicly.
        it('renders the newest PUBLISHED program when the newest-by-start-date program is still draft', async () => {
            mockPrismaService.program.findMany.mockResolvedValue([]);

            const candidates = [
                {
                    ...baseProgramFields,
                    id: 'program-draft',
                    name: 'MEYS 7th (draft)',
                    slug: 'meys-7th',
                    status: 'draft',
                    startDate: new Date('2027-03-01T00:00:00.000Z'),
                    endDate: new Date('2027-03-05T00:00:00.000Z'),
                    registrationOpenDate: null,
                    registrationCloseDate: null,
                },
                {
                    ...baseProgramFields,
                    id: 'program-published',
                    name: 'MEYS 6th',
                    slug: 'meys-6th',
                    status: 'published',
                    startDate: new Date('2026-10-01T00:00:00.000Z'),
                    endDate: new Date('2026-10-05T00:00:00.000Z'),
                    registrationOpenDate: null,
                    registrationCloseDate: null,
                },
            ];

            // Simulates real Prisma filtering (including the `status: { not:
            // 'draft' }` guard) plus `orderBy: { startDate: 'desc' }`, so this
            // test fails if that guard is ever dropped from the query.
            mockPrismaService.program.findFirst.mockImplementation((args: any) => {
                const where = args?.where ?? {};
                const excludesDraft = where.status?.not === 'draft';
                const matches = candidates.filter((p) => !excludesDraft || p.status !== 'draft');
                const sorted = [...matches].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
                return Promise.resolve(sorted[0] ?? null);
            });

            const result: any = await strategy.getData({ id: 'brand-1', name: 'MEYS' } as any);

            expect(heroTitle(result)).toBe('MEYS 6th');
        });

        it('falls back to the default edition when `edition` names a draft program (not a currently-relevant edition)', async () => {
            // fetchOpenRegistrationPrograms already excludes drafts, so a
            // draft's slug is never present in `twoOpenEditions` and simply
            // can't match — same silent-fallback path as an unknown slug.
            mockEditionsAndPrograms();

            const result: any = await strategy.getData(
                { id: 'brand-1', name: 'MEYS' } as any,
                'meys-8th-draft',
            );

            expect(heroTitle(result)).toBe('MEYS 6th');
        });

        it('caches each resolved edition under its own key so one edition never serves another\'s payload', async () => {
            mockEditionsAndPrograms();

            await strategy.getData({ id: 'brand-1', name: 'MEYS' } as any, 'meys-6th');
            await strategy.getData({ id: 'brand-1', name: 'MEYS' } as any, 'meys-7th');

            const cacheKeysUsed = mockCacheService.set.mock.calls.map((call) => call[0]);
            expect(cacheKeysUsed).toHaveLength(2);
            expect(cacheKeysUsed[0]).not.toBe(cacheKeysUsed[1]);
            expect(cacheKeysUsed[0]).toContain('meys-6th');
            expect(cacheKeysUsed[1]).toContain('meys-7th');
        });
    });
});
