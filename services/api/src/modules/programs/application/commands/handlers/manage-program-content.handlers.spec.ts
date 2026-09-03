
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import {
    CreateProgramEssayHandler,
    CreateProgramSpeakerHandler,
    DeleteProgramEssayHandler,
    UpdateProgramEssayHandler,
    UpdateProgramSpeakerHandler,
    CreateValidityPeriodHandler,
    UpdateValidityPeriodHandler,
    invalidateLandingCacheByProgramId,
    CreateProgramGalleryHandler,
    DeleteProgramGalleryHandler,
    UpdateProgramGalleryHandler,
    CreateProgramTestimonialHandler,
    UpdateProgramTestimonialHandler,
    DeleteProgramTestimonialHandler,
    UpdateProgramFaqHandler,
    DeleteDocumentTemplateHandler,
    DeleteProgramTimelineHandler,
    CreateProgramTimelineHandler,
    UpdateProgramTimelineHandler,
    CreateProgramScheduleHandler,
    UpdateProgramScheduleHandler,
    DeleteProgramScheduleHandler,
    CreateProgramSubthemeHandler,
    UpdateProgramSubthemeHandler,
    DeleteProgramSubthemeHandler,
    CreateProgramPartnerHandler,
    UpdateProgramPartnerHandler,
    DeleteProgramPartnerHandler,
    CreateProgramResourceHandler,
    UpdateProgramResourceHandler,
    DeleteProgramResourceHandler,
    CreateProgramPricingTierHandler,
    UpdateProgramPricingTierHandler,
    DeleteProgramPricingTierHandler,
    DeleteValidityPeriodHandler,
    UpdateProgramPaymentInfoHandler,
    UpdateProgramContactHandler,
    UpdateProgramLandingContentHandler,
} from './manage-program-content.handlers';
import {
    CreateProgramEssayCommand,
    CreateProgramSpeakerCommand,
    DeleteProgramEssayCommand,
    UpdateProgramEssayCommand,
    UpdateProgramSpeakerCommand,
    CreateValidityPeriodCommand,
    UpdateValidityPeriodCommand,
    CreateProgramGalleryCommand,
    DeleteProgramGalleryCommand,
    UpdateProgramGalleryCommand,
    CreateProgramTestimonialCommand,
    UpdateProgramTestimonialCommand,
    DeleteProgramTestimonialCommand,
    UpdateProgramFaqCommand,
    DeleteDocumentTemplateCommand,
    DeleteProgramTimelineCommand,
    CreateProgramTimelineCommand,
    UpdateProgramTimelineCommand,
    CreateProgramScheduleCommand,
    UpdateProgramScheduleCommand,
    DeleteProgramScheduleCommand,
    CreateProgramSubthemeCommand,
    UpdateProgramSubthemeCommand,
    DeleteProgramSubthemeCommand,
    CreateProgramPartnerCommand,
    UpdateProgramPartnerCommand,
    DeleteProgramPartnerCommand,
    CreateProgramResourceCommand,
    UpdateProgramResourceCommand,
    DeleteProgramResourceCommand,
    CreateProgramPricingTierCommand,
    UpdateProgramPricingTierCommand,
    DeleteProgramPricingTierCommand,
    DeleteValidityPeriodCommand,
    UpdateProgramPaymentInfoCommand,
    UpdateProgramContactCommand,
    UpdateProgramLandingContentCommand,
} from '../program-content.commands';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { StorageService } from '../../../../files/application/storage.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';

// BadRequestException here carries a structured { code, message } response
// body, and Nest's HttpException surfaces that body's own `message` string
// as the thrown error's `.message` — not the `code` — so
// `.rejects.toThrow(/code/)` can never match. Asserting on `.getResponse().code`
// is this codebase's established way to check a structured exception's code
// (see rundowns.copier.spec.ts).
async function captureError(promise: Promise<unknown>): Promise<any> {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('expected promise to reject');
}

const homeAndSettingsOptions = {
    clearSnapshot: true,
    bustProgramCache: true,
    swallowErrors: true,
    revalidate: { kind: 'homeAndSettings' as const },
};

describe('ManageProgramContentHandlers', () => {
    
    // --- MOCKS ---
    let repository: any;
    let storageService: any;
    let prismaService: any;

    const mockRepository = {
        createSpeaker: jest.fn(),
        findSpeakerById: jest.fn(),
        updateSpeaker: jest.fn(),
        createEssay: jest.fn(),
        findEssayById: jest.fn(),
        updateEssay: jest.fn(),
        deleteEssay: jest.fn(),
    };

    const mockStorageService = {
        uploadFile: jest.fn(),
    };

    const mockPrismaService = {
        program: {
            findUnique: jest.fn(),
        },
    };

    const mockCacheService = {
        invalidateByPatterns: jest.fn(),
    };

    beforeEach(async () => {
         // Reset mocks
         jest.clearAllMocks();
    });

    describe('CreateProgramSpeakerHandler', () => {
        let handler: CreateProgramSpeakerHandler;

        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    CreateProgramSpeakerHandler,
                    { provide: 'IProgramContentRepository', useValue: mockRepository },
                    { provide: StorageService, useValue: mockStorageService },
                    { provide: PrismaService, useValue: mockPrismaService },
                ],
            }).compile();
            handler = module.get<CreateProgramSpeakerHandler>(CreateProgramSpeakerHandler);
        });

        it('should create speaker with uploaded photo', async () => {
            const dto = { programId: 'prog-1', name: 'Speaker 1' };
            const file = { originalname: 'photo.jpg' } as unknown as Express.Multer.File;
            const command = new CreateProgramSpeakerCommand(dto, 'user-1', file);

            // Mock Program existence for Brand ID lookup
            mockPrismaService.program.findUnique.mockResolvedValue({ id: 'prog-1', brandId: 'brand-1' });
            
            // Mock Upload
            mockStorageService.uploadFile.mockResolvedValue({ url: 'http://cdn/photo.jpg' });

            // Mock Create
            mockRepository.createSpeaker.mockResolvedValue({ id: 'spk-1', ...dto, photoUrl: 'http://cdn/photo.jpg' });

            const result = await handler.execute(command);

            expect(mockPrismaService.program.findUnique).toHaveBeenCalledWith({ where: { id: 'prog-1' } });
            expect(mockStorageService.uploadFile).toHaveBeenCalledWith(file, 'user-1', 'brand-1', 'speakers', 'prog-1');
            expect(mockRepository.createSpeaker).toHaveBeenCalledWith(expect.objectContaining({
                photoUrl: 'http://cdn/photo.jpg'
            }));
            expect(result.id).toBe('spk-1');
        });

        it('should throw NotFoundException if program not found during upload', async () => {
            const dto = { programId: 'prog-1', name: 'Speaker' };
            const command = new CreateProgramSpeakerCommand(dto, 'user-1', {} as unknown as Express.Multer.File);

            mockPrismaService.program.findUnique.mockResolvedValue(null);

            await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
            expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
        });
    });

    describe('UpdateProgramSpeakerHandler', () => {
        let handler: UpdateProgramSpeakerHandler;

        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    UpdateProgramSpeakerHandler,
                    { provide: 'IProgramContentRepository', useValue: mockRepository },
                    { provide: StorageService, useValue: mockStorageService },
                    { provide: PrismaService, useValue: mockPrismaService },
                ],
            }).compile();
            handler = module.get<UpdateProgramSpeakerHandler>(UpdateProgramSpeakerHandler);
        });

        it('should update speaker photo if new file provided', async () => {
            const dto = { name: 'Updated Name' };
            const file = { originalname: 'new.jpg' } as unknown as Express.Multer.File;
            const command = new UpdateProgramSpeakerCommand('spk-1', dto, 'user-1', file);

            // Mock Speaker Lookup
            mockRepository.findSpeakerById.mockResolvedValue({ id: 'spk-1', programId: 'prog-1' });

            // Mock Program Lookup
            mockPrismaService.program.findUnique.mockResolvedValue({ id: 'prog-1', brandId: 'brand-1' });

            // Mock Upload
            mockStorageService.uploadFile.mockResolvedValue({ url: 'http://cdn/new.jpg' });

            // Mock Update
            mockRepository.updateSpeaker.mockResolvedValue({ id: 'spk-1', name: 'Updated Name', photoUrl: 'http://cdn/new.jpg' });

            await handler.execute(command);

            expect(mockRepository.findSpeakerById).toHaveBeenCalledWith('spk-1');
            expect(mockStorageService.uploadFile).toHaveBeenCalledWith(file, 'user-1', 'brand-1', 'speakers', 'prog-1');
            expect(mockRepository.updateSpeaker).toHaveBeenCalledWith('spk-1', expect.objectContaining({
                photoUrl: 'http://cdn/new.jpg'
            }));
        });
    });

    describe('Essay cache invalidation', () => {
        beforeEach(() => {
            mockCacheService.invalidateByPatterns.mockResolvedValue(undefined);
        });

        it('invalidates portal essay caches after creating an essay', async () => {
            const handler = new CreateProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new CreateProgramEssayCommand(
                {
                    programId: 'program-1',
                    question: 'Why should we pick you?',
                },
                'user-1',
            );

            mockRepository.createEssay.mockResolvedValue({ id: 'essay-1', ...command.dto });

            await handler.execute(command);

            expect(mockRepository.createEssay).toHaveBeenCalledWith(command.dto);
            expect(mockCacheService.invalidateByPatterns).toHaveBeenCalledWith([
                'program:essays:program-1',
                'portal:submission-detail:*:program-1',
                'portal:submission-detail:*:latest',
                'portal:submissions:*:program-1',
                'portal:submissions:*:latest',
                'portal:dashboard:*',
            ]);
        });

        it('rejects creating essay with placeholder question', async () => {
            const handler = new CreateProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new CreateProgramEssayCommand(
                {
                    programId: 'program-1',
                    question: '-',
                },
                'user-1',
            );

            await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
            expect(mockRepository.createEssay).not.toHaveBeenCalled();
        });

        it('invalidates portal essay caches after updating an essay', async () => {
            const handler = new UpdateProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new UpdateProgramEssayCommand(
                'essay-1',
                { question: 'Updated question' },
                'user-1',
            );

            mockRepository.findEssayById.mockResolvedValue({ id: 'essay-1', programId: 'program-1' });
            mockRepository.updateEssay.mockResolvedValue({
                id: 'essay-1',
                programId: 'program-1',
                question: 'Updated question',
            });

            await handler.execute(command);

            expect(mockRepository.findEssayById).toHaveBeenCalledWith('essay-1');
            expect(mockRepository.updateEssay).toHaveBeenCalledWith('essay-1', command.dto);
            expect(mockCacheService.invalidateByPatterns).toHaveBeenCalledWith([
                'program:essays:program-1',
                'portal:submission-detail:*:program-1',
                'portal:submission-detail:*:latest',
                'portal:submissions:*:program-1',
                'portal:submissions:*:latest',
                'portal:dashboard:*',
            ]);
        });

        it('rejects updating essay with placeholder question', async () => {
            const handler = new UpdateProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new UpdateProgramEssayCommand(
                'essay-1',
                { question: '  n/a  ' },
                'user-1',
            );

            mockRepository.findEssayById.mockResolvedValue({ id: 'essay-1', programId: 'program-1' });

            await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
            expect(mockRepository.updateEssay).not.toHaveBeenCalled();
        });

        it('invalidates portal essay caches after deleting an essay', async () => {
            const handler = new DeleteProgramEssayHandler(
                mockRepository as unknown as IProgramContentRepository,
                mockCacheService as unknown as CacheService,
            );
            const command = new DeleteProgramEssayCommand('essay-1', 'user-1');

            mockRepository.findEssayById.mockResolvedValue({ id: 'essay-1', programId: 'program-1' });
            mockRepository.deleteEssay.mockResolvedValue(undefined);

            await handler.execute(command);

            expect(mockRepository.findEssayById).toHaveBeenCalledWith('essay-1');
            expect(mockRepository.deleteEssay).toHaveBeenCalledWith('essay-1');
            expect(mockCacheService.invalidateByPatterns).toHaveBeenCalledWith([
                'program:essays:program-1',
                'portal:submission-detail:*:program-1',
                'portal:submission-detail:*:latest',
                'portal:submissions:*:program-1',
                'portal:submissions:*:latest',
                'portal:dashboard:*',
            ]);
        });
    });

    // 2026-08-21 incident: pricing_tier_validity_periods rows carry no price —
    // a period is purely a time window gating whether the tier resolves as
    // "active" right now. Bad ranges and duplicate rows silently broke the
    // registration CTA. These tests exercise the two live write paths that
    // create/mutate a period, wired through the shared validator in
    // pricing-tier-validity-period.validator.ts (unit-tested separately).
    describe('Validity Period Handlers', () => {
        let vpRepository: any;
        let vpPrisma: any;
        let vpCache: any;
        let vpLandingCacheInvalidation: any;

        beforeEach(() => {
            vpRepository = {
                createValidityPeriod: jest.fn(),
                updateValidityPeriod: jest.fn(),
                findValidityPeriodById: jest.fn(),
                findPricingTierById: jest.fn(),
            };
            vpPrisma = {
                programPricingTier: { findUnique: jest.fn() },
                program: { findUnique: jest.fn() },
                brandLandingSnapshot: { deleteMany: jest.fn() },
            };
            vpCache = {
                invalidateBrandLandingCaches: jest.fn(),
                invalidateByPattern: jest.fn(),
            };
            vpLandingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
        });

        async function buildModule<T>(HandlerCtor: new (...args: any[]) => T): Promise<T> {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    HandlerCtor,
                    { provide: 'IProgramContentRepository', useValue: vpRepository },
                    { provide: PrismaService, useValue: vpPrisma },
                    { provide: CacheService, useValue: vpCache },
                    { provide: LandingCacheInvalidationService, useValue: vpLandingCacheInvalidation },
                ],
            }).compile();
            return module.get(HandlerCtor);
        }

        describe('CreateValidityPeriodHandler', () => {
            it('rejects a zero-length period before ever calling the repository', async () => {
                // Real prod row: MEYS "Period 8", 2026-09-03 16:59 -> same instant.
                const handler = await buildModule(CreateValidityPeriodHandler);
                const command = new CreateValidityPeriodCommand(
                    { pricingTierId: 'tier-1', startDate: '2026-09-03T16:59:00.000Z', endDate: '2026-09-03T16:59:00.000Z' },
                    'user-1',
                );

                await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
                expect(vpRepository.findPricingTierById).not.toHaveBeenCalled();
                expect(vpRepository.createValidityPeriod).not.toHaveBeenCalled();
            });

            it('rejects an exact duplicate of an existing sibling period', async () => {
                // Real prod incident: China self-funded "Period 12" ended up with
                // 5 byte-identical rows on the same tier.
                const handler = await buildModule(CreateValidityPeriodHandler);
                const command = new CreateValidityPeriodCommand(
                    { pricingTierId: 'tier-1', startDate: '2026-09-20T16:59:00.000Z', endDate: '2026-10-21T16:59:00.000Z' },
                    'user-1',
                );
                vpRepository.findPricingTierById.mockResolvedValue({
                    id: 'tier-1',
                    programId: 'prog-1',
                    validityPeriods: [
                        { id: 'period-12', startDate: new Date('2026-09-20T16:59:00.000Z'), endDate: new Date('2026-10-21T16:59:00.000Z'), description: 'Period 12' },
                    ],
                });

                await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
                expect(vpRepository.createValidityPeriod).not.toHaveBeenCalled();
            });

            it('pins a brand-new tier\'s first period to WIB start-of-day even when entered at 23:59 WIB (2026-09-01 MEYS incident)', async () => {
                const handler = await buildModule(CreateValidityPeriodHandler);
                // Admin picked 1 Sept as the opening day but the datetime input
                // carried 23:59 WIB (16:59 UTC), same as they'd type for an "until".
                const command = new CreateValidityPeriodCommand(
                    { pricingTierId: 'tier-1', startDate: '2026-09-01T16:59:00.000Z', endDate: '2026-09-30T16:59:00.000Z' },
                    'user-1',
                );
                vpRepository.findPricingTierById.mockResolvedValue({ id: 'tier-1', programId: 'prog-1', validityPeriods: [] });
                vpRepository.createValidityPeriod.mockResolvedValue({
                    id: 'p1',
                    pricingTierId: 'tier-1',
                    startDate: new Date('2026-08-31T17:00:00.000Z'),
                    endDate: new Date('2026-09-30T16:59:00.000Z'),
                    description: null,
                });
                vpPrisma.program.findUnique.mockResolvedValue({ registrationCloseDate: null });

                await handler.execute(command);

                expect(vpRepository.createValidityPeriod).toHaveBeenCalledWith(
                    expect.objectContaining({ startDate: new Date('2026-08-31T17:00:00.000Z') }), // WIB midnight, 1 Sept
                );
            });

            it('leaves a chained continuation period\'s exact 23:59 WIB start untouched', async () => {
                const handler = await buildModule(CreateValidityPeriodHandler);
                // Installment 2 legitimately starts the instant installment 1 ends.
                const command = new CreateValidityPeriodCommand(
                    { pricingTierId: 'tier-1', startDate: '2026-09-10T16:59:00.000Z', endDate: '2026-09-30T16:59:00.000Z' },
                    'user-1',
                );
                vpRepository.findPricingTierById.mockResolvedValue({
                    id: 'tier-1',
                    programId: 'prog-1',
                    validityPeriods: [
                        { id: 'installment-1', startDate: new Date('2026-09-01T00:00:00.000Z'), endDate: new Date('2026-09-10T16:59:00.000Z'), description: 'Installment 1' },
                    ],
                });
                vpRepository.createValidityPeriod.mockResolvedValue({
                    id: 'installment-2',
                    pricingTierId: 'tier-1',
                    startDate: new Date('2026-09-10T16:59:00.000Z'),
                    endDate: new Date('2026-09-30T16:59:00.000Z'),
                    description: null,
                });
                vpPrisma.program.findUnique.mockResolvedValue({ registrationCloseDate: null });

                await handler.execute(command);

                expect(vpRepository.createValidityPeriod).toHaveBeenCalledWith(
                    expect.objectContaining({ startDate: new Date('2026-09-10T16:59:00.000Z') }), // untouched handover instant
                );
            });

            it('creates the period and returns overlap/coverage-gap warnings without blocking the save', async () => {
                // Real prod: MEYS fully-funded had two live overlapping periods.
                // Overlap must surface as a warning, not reject the write.
                const handler = await buildModule(CreateValidityPeriodHandler);
                const command = new CreateValidityPeriodCommand(
                    { pricingTierId: 'tier-1', startDate: '2026-07-28T00:00:00.000Z', endDate: '2026-09-01T00:00:00.000Z' },
                    'user-1',
                );
                // Pre-write lookup (duplicate check): only the sibling exists yet.
                vpRepository.findPricingTierById.mockResolvedValueOnce({
                    id: 'tier-1',
                    programId: 'prog-1',
                    validityPeriods: [
                        { id: 'p4', startDate: new Date('2026-07-28T00:00:00.000Z'), endDate: new Date('2026-08-31T00:00:00.000Z'), description: 'P4' },
                    ],
                });
                vpRepository.createValidityPeriod.mockResolvedValue({
                    id: 'p5',
                    pricingTierId: 'tier-1',
                    startDate: new Date('2026-07-28T00:00:00.000Z'),
                    endDate: new Date('2026-09-01T00:00:00.000Z'),
                    description: null,
                });
                // Post-write lookup (warnings): now includes the just-created row.
                vpRepository.findPricingTierById.mockResolvedValueOnce({
                    id: 'tier-1',
                    programId: 'prog-1',
                    validityPeriods: [
                        { id: 'p4', startDate: new Date('2026-07-28T00:00:00.000Z'), endDate: new Date('2026-08-31T00:00:00.000Z'), description: 'P4' },
                        { id: 'p5', startDate: new Date('2026-07-28T00:00:00.000Z'), endDate: new Date('2026-09-01T00:00:00.000Z'), description: null },
                    ],
                });
                vpPrisma.program.findUnique.mockResolvedValue({ registrationCloseDate: null });

                const result = await handler.execute(command);

                expect(vpRepository.createValidityPeriod).toHaveBeenCalled();
                expect(result.warnings.overlappingPeriods.map((p: any) => p.id)).toEqual(['p4']);
                expect(result.warnings.coverageGap).toBeNull();
            });

            it('fires the homeAndSettings revalidation hook after creating', async () => {
                const handler = await buildModule(CreateValidityPeriodHandler);
                const command = new CreateValidityPeriodCommand(
                    { pricingTierId: 'tier-1', startDate: '2026-07-01T00:00:00.000Z', endDate: '2026-08-01T00:00:00.000Z' },
                    'user-1',
                );
                vpRepository.findPricingTierById.mockResolvedValue({ id: 'tier-1', programId: 'prog-1', validityPeriods: [] });
                vpRepository.createValidityPeriod.mockResolvedValue({
                    id: 'p1',
                    pricingTierId: 'tier-1',
                    startDate: new Date('2026-07-01T00:00:00.000Z'),
                    endDate: new Date('2026-08-01T00:00:00.000Z'),
                    description: null,
                });
                vpPrisma.program.findUnique.mockResolvedValue({ registrationCloseDate: null });
                vpPrisma.programPricingTier.findUnique.mockResolvedValue({ program: { brandId: 'brand-9' } });

                await handler.execute(command);

                expect(vpLandingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-9', {
                    clearSnapshot: false,
                    bustProgramCache: false,
                    swallowErrors: true,
                    revalidate: { kind: 'homeAndSettings' },
                });
            });
        });

        describe('UpdateValidityPeriodHandler', () => {
            it('excludes the row being updated from its own duplicate check', async () => {
                // Editing a period's description only (dates unchanged) must not
                // trip the duplicate check by comparing the row to itself.
                const handler = await buildModule(UpdateValidityPeriodHandler);
                const command = new UpdateValidityPeriodCommand('period-12', { description: 'Renamed' }, 'user-1');
                const existing = {
                    id: 'period-12',
                    pricingTierId: 'tier-1',
                    startDate: new Date('2026-09-20T16:59:00.000Z'),
                    endDate: new Date('2026-10-21T16:59:00.000Z'),
                    description: 'Period 12',
                };
                vpRepository.findValidityPeriodById.mockResolvedValue(existing);
                vpRepository.findPricingTierById.mockResolvedValue({
                    id: 'tier-1',
                    programId: 'prog-1',
                    validityPeriods: [existing],
                });
                vpRepository.updateValidityPeriod.mockResolvedValue({ ...existing, description: 'Renamed' });
                vpPrisma.program.findUnique.mockResolvedValue({ registrationCloseDate: null });

                const result = await handler.execute(command);

                expect(vpRepository.updateValidityPeriod).toHaveBeenCalled();
                expect(result.description).toBe('Renamed');
            });

            it('fires the homeAndSettings revalidation hook after updating', async () => {
                const handler = await buildModule(UpdateValidityPeriodHandler);
                const command = new UpdateValidityPeriodCommand('period-12', { description: 'Renamed again' }, 'user-1');
                const existing = {
                    id: 'period-12',
                    pricingTierId: 'tier-1',
                    startDate: new Date('2026-09-20T16:59:00.000Z'),
                    endDate: new Date('2026-10-21T16:59:00.000Z'),
                    description: 'Period 12',
                };
                vpRepository.findValidityPeriodById.mockResolvedValue(existing);
                vpRepository.findPricingTierById.mockResolvedValue({
                    id: 'tier-1',
                    programId: 'prog-1',
                    validityPeriods: [existing],
                });
                vpRepository.updateValidityPeriod.mockResolvedValue({ ...existing, description: 'Renamed again' });
                vpPrisma.program.findUnique.mockResolvedValue({ registrationCloseDate: null });
                vpPrisma.programPricingTier.findUnique.mockResolvedValue({ program: { brandId: 'brand-9' } });

                await handler.execute(command);

                expect(vpLandingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-9', {
                    clearSnapshot: false,
                    bustProgramCache: false,
                    swallowErrors: true,
                    revalidate: { kind: 'homeAndSettings' },
                });
            });

            it('rejects an update that would invert the range', async () => {
                const handler = await buildModule(UpdateValidityPeriodHandler);
                const command = new UpdateValidityPeriodCommand(
                    'period-1',
                    { startDate: '2026-09-05T00:00:00.000Z', endDate: '2026-09-01T00:00:00.000Z' },
                    'user-1',
                );
                vpRepository.findValidityPeriodById.mockResolvedValue({
                    id: 'period-1',
                    pricingTierId: 'tier-1',
                    startDate: new Date('2026-09-01T00:00:00.000Z'),
                    endDate: new Date('2026-09-02T00:00:00.000Z'),
                    description: null,
                });

                await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
                expect(vpRepository.updateValidityPeriod).not.toHaveBeenCalled();
            });
        });

        describe('DeleteValidityPeriodHandler fires the frontend revalidation hook', () => {
            it('resolves brandId via pricingTierId and fires homeAndSettings revalidation without re-clearing snapshot/program cache', async () => {
                const handler = await buildModule(DeleteValidityPeriodHandler);
                vpRepository.findValidityPeriodById.mockResolvedValue({ id: 'period-1', pricingTierId: 'tier-1' });
                vpRepository.deleteValidityPeriod = jest.fn().mockResolvedValue(undefined);
                vpPrisma.programPricingTier.findUnique.mockResolvedValue({ program: { brandId: 'brand-9' } });

                await handler.execute(new DeleteValidityPeriodCommand('period-1', 'user-1'));

                expect(vpPrisma.programPricingTier.findUnique).toHaveBeenCalledWith({
                    where: { id: 'tier-1' },
                    select: { program: { select: { brandId: true } } },
                });
                expect(vpLandingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-9', {
                    clearSnapshot: false,
                    bustProgramCache: false,
                    swallowErrors: true,
                    revalidate: { kind: 'homeAndSettings' },
                });
            });
        });
    });

    // Audit: gallery/faq/document-template mutations cleared the Redis brand
    // keys + Postgres snapshot via this shared helper, but the helper never
    // fired LandingRevalidationService, so the Next.js frontend cache was
    // never nudged. Fixed once here instead of at each of the ~9 call sites.
    describe('invalidateLandingCacheByProgramId', () => {
        it('resolves the brandId for the program and routes through the shared service with the home+settings hook', async () => {
            const prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-7' }) } };
            const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };

            await invalidateLandingCacheByProgramId('prog-1', prisma as any, landingCacheInvalidation as any);

            expect(prisma.program.findUnique).toHaveBeenCalledWith({
                where: { id: 'prog-1' },
                select: { brandId: true },
            });
            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-7', homeAndSettingsOptions);
        });

        it('does nothing when the program cannot be found', async () => {
            const prisma = { program: { findUnique: jest.fn().mockResolvedValue(null) } };
            const landingCacheInvalidation = { invalidate: jest.fn() };

            await invalidateLandingCacheByProgramId('prog-missing', prisma as any, landingCacheInvalidation as any);

            expect(landingCacheInvalidation.invalidate).not.toHaveBeenCalled();
        });

        it('swallows a brandId lookup failure instead of throwing (non-critical background invalidation)', async () => {
            const prisma = { program: { findUnique: jest.fn().mockRejectedValue(new Error('db down')) } };
            const landingCacheInvalidation = { invalidate: jest.fn() };

            await expect(
                invalidateLandingCacheByProgramId('prog-1', prisma as any, landingCacheInvalidation as any),
            ).resolves.toBeUndefined();
        });
    });

    describe('Handlers wired through invalidateLandingCacheByProgramId', () => {
        let repo: any;
        let storage: any;
        let prisma: any;
        let cache: any;
        let landingCacheInvalidation: any;
        let prismaRead: any;

        beforeEach(() => {
            repo = {
                createGallery: jest.fn(),
                findFaqById: jest.fn(),
                updateFaq: jest.fn(),
                findDocumentTemplateById: jest.fn(),
                deleteDocumentTemplate: jest.fn(),
            };
            storage = { uploadFile: jest.fn() };
            prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-x' }) } };
            cache = { invalidateByPattern: jest.fn().mockResolvedValue(undefined) };
            landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
            // The gallery handlers now assert the caller's programme scope before
            // writing. A platform-scope admin passes every programme, which keeps
            // these cache-invalidation tests about cache invalidation.
            prismaRead = {
                admin: {
                    findUnique: jest.fn().mockResolvedValue({
                        accessLevel: 5,
                        canManageAdmins: true,
                        canAssignRoles: true,
                        customPermissions: [],
                        role: { name: 'super_admin', permissions: ['platform_access'] },
                        adminBrands: [],
                        adminPrograms: [],
                    }),
                },
                program: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 'prog-1', brandId: 'brand-x', name: 'P', deletedAt: null,
                    }),
                },
            };
        });

        async function build<T>(HandlerCtor: new (...args: any[]) => T): Promise<T> {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    HandlerCtor,
                    { provide: 'IProgramContentRepository', useValue: repo },
                    { provide: StorageService, useValue: storage },
                    { provide: PrismaService, useValue: prisma },
                    { provide: CacheService, useValue: cache },
                    { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
                    { provide: PrismaReadService, useValue: prismaRead },
                ],
            }).compile();
            return module.get(HandlerCtor);
        }

        // ADOPTION, not just the abstraction. program-content-access.util.spec.ts
        // proves the rule is correct; nothing there proves these handlers call
        // it. That exact gap is why #154 was needed - a shared rule was unit
        // tested while three call sites quietly kept their own.
        describe('programme scope enforcement', () => {
            const outOfScope = () => ({
                admin: {
                    findUnique: jest.fn().mockResolvedValue({
                        accessLevel: 1,
                        canManageAdmins: false,
                        canAssignRoles: false,
                        customPermissions: [],
                        role: { name: 'reviewer', permissions: [] },
                        adminBrands: [],
                        adminPrograms: [{ programId: 'someone-elses-program', permissions: [] }],
                    }),
                },
                program: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 'prog-1', brandId: 'brand-x', name: 'P', deletedAt: null,
                    }),
                },
            });
            const actor = { userId: 'u', email: 'a@b.c', brandId: 'brand-x', adminId: 'adm-1' } as never;

            it('CreateProgramGalleryHandler refuses a programme outside the caller scope', async () => {
                prismaRead = outOfScope();
                const handler = await build(CreateProgramGalleryHandler);

                await expect(
                    handler.execute(new CreateProgramGalleryCommand(
                        { programId: 'prog-1', imageUrl: 'https://x.example/i.png' } as never,
                        'user-1',
                        actor,
                    )),
                ).rejects.toThrow();

                expect(repo.createGallery).not.toHaveBeenCalled();
            });

            it('UpdateProgramGalleryHandler refuses, resolving the programme from the target row', async () => {
                prismaRead = outOfScope();
                repo.findGalleryById = jest.fn().mockResolvedValue({ id: 'gal-1', programId: 'prog-1' });
                repo.updateGallery = jest.fn();
                const handler = await build(UpdateProgramGalleryHandler);

                await expect(
                    handler.execute(new UpdateProgramGalleryCommand('gal-1', {} as never, 'user-1', actor)),
                ).rejects.toThrow();

                expect(repo.updateGallery).not.toHaveBeenCalled();
            });

            // The sharp one. This handler used to call deleteGallery FIRST and
            // read programId only afterwards for cache invalidation, so the row
            // was already gone before anything knew whose it was - there was no
            // point at which a check could have refused it.
            it('DeleteProgramGalleryHandler refuses BEFORE deleting, not after', async () => {
                prismaRead = outOfScope();
                repo.findGalleryById = jest.fn().mockResolvedValue({ id: 'gal-1', programId: 'prog-1' });
                repo.deleteGallery = jest.fn();
                const handler = await build(DeleteProgramGalleryHandler);

                await expect(
                    handler.execute(new DeleteProgramGalleryCommand('gal-1', 'user-1', actor)),
                ).rejects.toThrow();

                expect(repo.deleteGallery).not.toHaveBeenCalled();
            });
        });

        it('CreateProgramGalleryHandler invalidates via the shared service after creating', async () => {
            const handler = await build(CreateProgramGalleryHandler);
            repo.createGallery.mockResolvedValue({ id: 'gal-1' });

            await handler.execute(new CreateProgramGalleryCommand(
                { programId: 'prog-1', imageUrl: 'https://x.example/img.png' } as any,
                'user-1',
                { userId: 'user-1', email: 'a@b.c', brandId: 'brand-1', adminId: 'adm-1' } as any,
            ));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-x', homeAndSettingsOptions);
        });

        it('UpdateProgramFaqHandler invalidates via the shared service after updating', async () => {
            const handler = await build(UpdateProgramFaqHandler);
            repo.findFaqById.mockResolvedValue({ id: 'faq-1', programId: 'prog-1' });
            repo.updateFaq.mockResolvedValue({ id: 'faq-1', programId: 'prog-1' });

            await handler.execute(new UpdateProgramFaqCommand('faq-1', { question: 'Updated?' } as any, 'user-1'));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-x', homeAndSettingsOptions);
        });

        it('DeleteDocumentTemplateHandler invalidates via the shared service and still clears portal document caches', async () => {
            const handler = await build(DeleteDocumentTemplateHandler);
            repo.findDocumentTemplateById.mockResolvedValue({ id: 'doc-1', programId: 'prog-1' });
            repo.deleteDocumentTemplate.mockResolvedValue(undefined);

            await handler.execute(new DeleteDocumentTemplateCommand('doc-1', 'user-1'));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-x', homeAndSettingsOptions);
            expect(cache.invalidateByPattern).toHaveBeenCalledWith('portal:documents:*');
        });
    });

    // Testimonial handlers used to clear the snapshot and Redis inline without
    // firing the revalidate hook, so an edit left the participant frontend's
    // Next.js unstable_cache serving the old copy until its TTL lapsed.
    describe('Testimonial handlers fire the frontend revalidation hook', () => {
        let repo: any;
        let prisma: any;
        let landingCacheInvalidation: any;

        beforeEach(() => {
            repo = {
                createTestimonial: jest.fn().mockResolvedValue({ id: 't-1' }),
                updateTestimonial: jest.fn().mockResolvedValue({ id: 't-1' }),
                deleteTestimonial: jest.fn().mockResolvedValue(undefined),
            };
            prisma = {
                programTestimonial: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-kys' }) },
            };
            landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
        });

        async function build<T>(HandlerCtor: new (...args: any[]) => T): Promise<T> {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    HandlerCtor,
                    { provide: 'IProgramContentRepository', useValue: repo },
                    { provide: PrismaService, useValue: prisma },
                    { provide: CacheService, useValue: { invalidateByPattern: jest.fn(), invalidateBrandLandingCaches: jest.fn() } },
                    { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
                ],
            }).compile();
            return module.get(HandlerCtor);
        }

        it('CreateProgramTestimonialHandler revalidates the brand it was filed under', async () => {
            const handler = await build(CreateProgramTestimonialHandler);

            await handler.execute(new CreateProgramTestimonialCommand(
                { brandId: 'brand-kys', name: 'Alum', testimonial: 'Great', type: 'video' } as any,
                'user-1',
            ));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-kys', homeAndSettingsOptions);
        });

        it('UpdateProgramTestimonialHandler revalidates after updating', async () => {
            const handler = await build(UpdateProgramTestimonialHandler);

            await handler.execute(new UpdateProgramTestimonialCommand('t-1', { name: 'Renamed' } as any, 'user-1'));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-kys', homeAndSettingsOptions);
        });

        it('DeleteProgramTestimonialHandler revalidates after deleting', async () => {
            const handler = await build(DeleteProgramTestimonialHandler);

            await handler.execute(new DeleteProgramTestimonialCommand('t-1', 'user-1'));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-kys', homeAndSettingsOptions);
        });
    });

    // Group C: these handlers previously had no cache invalidation at all, so
    // an edit never showed up publicly until the cache TTL lapsed. Confirmed
    // landing-rendered first (programs.strategy.ts reads timeline/schedules/
    // subthemes; partners-sponsors.strategy.ts reads programPartner) before
    // wiring them up.
    describe('Group C: previously-uninvalidated content handlers', () => {
        let repo: any;
        let storage: any;
        let prisma: any;
        let landingCacheInvalidation: any;

        beforeEach(() => {
            repo = {
                createTimeline: jest.fn(),
                updateTimeline: jest.fn(),
                findTimelineById: jest.fn(),
                deleteTimeline: jest.fn(),
                createSchedule: jest.fn(),
                updateSchedule: jest.fn(),
                deleteSchedule: jest.fn(),
                findScheduleById: jest.fn(),
                createSubtheme: jest.fn(),
                updateSubtheme: jest.fn(),
                deleteSubtheme: jest.fn(),
                findSubthemeById: jest.fn(),
                createPartner: jest.fn(),
                updatePartner: jest.fn(),
                deletePartner: jest.fn(),
                findPartnerById: jest.fn(),
            };
            storage = { uploadFile: jest.fn() };
            prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-c' }) } };
            landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
        });

        async function build<T>(HandlerCtor: new (...args: any[]) => T): Promise<T> {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    HandlerCtor,
                    { provide: 'IProgramContentRepository', useValue: repo },
                    { provide: StorageService, useValue: storage },
                    { provide: PrismaService, useValue: prisma },
                    { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
                    { provide: IUserActivityLogRepository, useValue: { create: jest.fn() } },
                ],
            }).compile();
            return module.get(HandlerCtor);
        }

        describe('CreateProgramTimelineHandler', () => {
            it('invalidates using the created row programId', async () => {
                const handler = await build(CreateProgramTimelineHandler);
                repo.createTimeline.mockResolvedValue({ id: 'tl-1', programId: 'prog-1' });

                await handler.execute(new CreateProgramTimelineCommand(
                    { programId: 'prog-1', date: '2026-09-01' } as any,
                    'user-1',
                ));

                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });
        });

        describe('UpdateProgramTimelineHandler', () => {
            it('invalidates using the updated row programId', async () => {
                const handler = await build(UpdateProgramTimelineHandler);
                repo.updateTimeline.mockResolvedValue({ id: 'tl-1', programId: 'prog-1' });

                await handler.execute(new UpdateProgramTimelineCommand('tl-1', { date: '2026-09-02' } as any, 'user-1'));

                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });
        });

        describe('DeleteProgramTimelineHandler', () => {
            it('reads the row before hard-deleting it (delete returns void, brandId would otherwise be lost) and invalidates', async () => {
                const handler = await build(DeleteProgramTimelineHandler);
                repo.findTimelineById.mockResolvedValue({ id: 'tl-1', programId: 'prog-1' });
                repo.deleteTimeline.mockResolvedValue(undefined);

                await handler.execute(new DeleteProgramTimelineCommand('tl-1', 'user-1'));

                expect(repo.findTimelineById).toHaveBeenCalledWith('tl-1');
                expect(repo.deleteTimeline).toHaveBeenCalledWith('tl-1');
                const findOrder = repo.findTimelineById.mock.invocationCallOrder[0];
                const deleteOrder = repo.deleteTimeline.mock.invocationCallOrder[0];
                expect(findOrder).toBeLessThan(deleteOrder);
                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });

            it('skips invalidation when the row is already gone', async () => {
                const handler = await build(DeleteProgramTimelineHandler);
                repo.findTimelineById.mockResolvedValue(null);
                repo.deleteTimeline.mockResolvedValue(undefined);

                await handler.execute(new DeleteProgramTimelineCommand('tl-missing', 'user-1'));

                expect(landingCacheInvalidation.invalidate).not.toHaveBeenCalled();
            });
        });

        describe('Schedule handlers', () => {
            it('CreateProgramScheduleHandler invalidates using the dto programId', async () => {
                const handler = await build(CreateProgramScheduleHandler);
                repo.createSchedule.mockResolvedValue({ id: 'sch-1', programId: 'prog-1' });

                await handler.execute(new CreateProgramScheduleCommand(
                    { programId: 'prog-1', day: 'Day 1', activity: 'Arrival' } as any,
                    'user-1',
                ));

                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });

            it('UpdateProgramScheduleHandler invalidates using the updated row programId', async () => {
                const handler = await build(UpdateProgramScheduleHandler);
                repo.updateSchedule.mockResolvedValue({ id: 'sch-1', programId: 'prog-1', activity: 'Updated' });

                await handler.execute(new UpdateProgramScheduleCommand('sch-1', { activity: 'Updated' } as any, 'user-1'));

                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });

            it('DeleteProgramScheduleHandler reads the row before hard-deleting it and invalidates', async () => {
                const handler = await build(DeleteProgramScheduleHandler);
                repo.findScheduleById.mockResolvedValue({ id: 'sch-1', programId: 'prog-1' });
                repo.deleteSchedule.mockResolvedValue(undefined);

                await handler.execute(new DeleteProgramScheduleCommand('sch-1', 'user-1'));

                expect(repo.findScheduleById).toHaveBeenCalledWith('sch-1');
                const findOrder = repo.findScheduleById.mock.invocationCallOrder[0];
                const deleteOrder = repo.deleteSchedule.mock.invocationCallOrder[0];
                expect(findOrder).toBeLessThan(deleteOrder);
                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });
        });

        describe('Subtheme handlers', () => {
            it('CreateProgramSubthemeHandler invalidates using the dto programId', async () => {
                const handler = await build(CreateProgramSubthemeHandler);
                repo.createSubtheme.mockResolvedValue({ id: 'sub-1', programId: 'prog-1' });

                await handler.execute(new CreateProgramSubthemeCommand(
                    { programId: 'prog-1', name: 'Sustainability' } as any,
                    'user-1',
                ));

                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });

            it('UpdateProgramSubthemeHandler invalidates using the updated row programId', async () => {
                const handler = await build(UpdateProgramSubthemeHandler);
                repo.updateSubtheme.mockResolvedValue({ id: 'sub-1', programId: 'prog-1', name: 'Renamed' });

                await handler.execute(new UpdateProgramSubthemeCommand('sub-1', { name: 'Renamed' } as any, 'user-1'));

                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });

            it('DeleteProgramSubthemeHandler reads the row before soft-deleting it (deleteSubtheme returns void) and invalidates', async () => {
                const handler = await build(DeleteProgramSubthemeHandler);
                repo.findSubthemeById.mockResolvedValue({ id: 'sub-1', programId: 'prog-1' });
                repo.deleteSubtheme.mockResolvedValue(undefined);

                await handler.execute(new DeleteProgramSubthemeCommand('sub-1', 'user-1'));

                expect(repo.findSubthemeById).toHaveBeenCalledWith('sub-1');
                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });
        });

        describe('Partner handlers', () => {
            it('CreateProgramPartnerHandler invalidates using the created row programId', async () => {
                const handler = await build(CreateProgramPartnerHandler);
                repo.createPartner.mockResolvedValue({ id: 'partner-1', programId: 'prog-1' });

                await handler.execute(new CreateProgramPartnerCommand(
                    { programId: 'prog-1', name: 'Acme Co' } as any,
                    'user-1',
                ));

                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });

            it('UpdateProgramPartnerHandler invalidates using the updated row programId', async () => {
                const handler = await build(UpdateProgramPartnerHandler);
                repo.updatePartner.mockResolvedValue({ id: 'partner-1', programId: 'prog-1', name: 'Renamed' });

                await handler.execute(new UpdateProgramPartnerCommand('partner-1', { name: 'Renamed' } as any, 'user-1'));

                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });

            it('DeleteProgramPartnerHandler reads the row before hard-deleting it and invalidates', async () => {
                const handler = await build(DeleteProgramPartnerHandler);
                repo.findPartnerById.mockResolvedValue({ id: 'partner-1', programId: 'prog-1' });
                repo.deletePartner.mockResolvedValue(undefined);

                await handler.execute(new DeleteProgramPartnerCommand('partner-1', 'user-1'));

                expect(repo.findPartnerById).toHaveBeenCalledWith('partner-1');
                const findOrder = repo.findPartnerById.mock.invocationCallOrder[0];
                const deleteOrder = repo.deletePartner.mock.invocationCallOrder[0];
                expect(findOrder).toBeLessThan(deleteOrder);
                expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-c', homeAndSettingsOptions);
            });
        });
    });

    // Gap: ProgramResource IS landing-rendered — home.strategy.ts includes the
    // `resources` relation and renders it as `guidelines`; programs.strategy.ts
    // includes it too, rendered as guide/guidebook links. Its handlers cleared
    // the Redis + Postgres snapshot layers via the (now-renamed) portal-only
    // helper but never fired the Next.js revalidation hook, so an edit stayed
    // stale on the public page until TTL. Wired through the same
    // invalidateLandingCacheByProgramId helper Group C already uses.
    describe('Group D: ProgramResource handlers', () => {
        let repo: any;
        let storage: any;
        let prisma: any;
        let cache: any;
        let landingCacheInvalidation: any;

        beforeEach(() => {
            repo = {
                createResource: jest.fn(),
                updateResource: jest.fn(),
                findResourceById: jest.fn(),
                deleteResource: jest.fn(),
            };
            storage = { uploadFile: jest.fn() };
            prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-d' }) } };
            cache = { invalidateByPatterns: jest.fn().mockResolvedValue(undefined) };
            landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
        });

        async function build<T>(HandlerCtor: new (...args: any[]) => T): Promise<T> {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    HandlerCtor,
                    { provide: 'IProgramContentRepository', useValue: repo },
                    { provide: StorageService, useValue: storage },
                    { provide: PrismaService, useValue: prisma },
                    { provide: CacheService, useValue: cache },
                    { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
                ],
            }).compile();
            return module.get(HandlerCtor);
        }

        it('CreateProgramResourceHandler invalidates landing caches and portal resource caches', async () => {
            const handler = await build(CreateProgramResourceHandler);
            repo.createResource.mockResolvedValue({ id: 'res-1', programId: 'prog-1' });

            await handler.execute(new CreateProgramResourceCommand(
                { programId: 'prog-1', title: 'Guidebook', sourceType: 'link', linkUrl: 'https://x.example/guide.pdf' } as any,
                'user-1',
            ));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-d', homeAndSettingsOptions);
            expect(cache.invalidateByPatterns).toHaveBeenCalledWith([
                'portal:submission-detail:*',
                'portal:documents:*',
            ]);
        });

        it('UpdateProgramResourceHandler invalidates landing caches and portal resource caches', async () => {
            const handler = await build(UpdateProgramResourceHandler);
            repo.findResourceById.mockResolvedValue({
                id: 'res-1',
                programId: 'prog-1',
                sourceType: 'link',
                linkUrl: 'https://x.example/guide.pdf',
            });
            repo.updateResource.mockResolvedValue({ id: 'res-1', programId: 'prog-1', title: 'Updated' });

            await handler.execute(new UpdateProgramResourceCommand('res-1', { title: 'Updated' } as any, 'user-1'));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-d', homeAndSettingsOptions);
            expect(cache.invalidateByPatterns).toHaveBeenCalledWith([
                'portal:submission-detail:*',
                'portal:documents:*',
            ]);
        });

        it('DeleteProgramResourceHandler reads the row before hard-deleting it and invalidates', async () => {
            const handler = await build(DeleteProgramResourceHandler);
            repo.findResourceById.mockResolvedValue({ id: 'res-1', programId: 'prog-1' });
            repo.deleteResource.mockResolvedValue(undefined);

            await handler.execute(new DeleteProgramResourceCommand('res-1', 'user-1'));

            expect(repo.findResourceById).toHaveBeenCalledWith('res-1');
            const findOrder = repo.findResourceById.mock.invocationCallOrder[0];
            const deleteOrder = repo.deleteResource.mock.invocationCallOrder[0];
            expect(findOrder).toBeLessThan(deleteOrder);
            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-d', homeAndSettingsOptions);
            expect(cache.invalidateByPatterns).toHaveBeenCalledWith([
                'portal:submission-detail:*',
                'portal:documents:*',
            ]);
        });

        it('DeleteProgramResourceHandler skips invalidation when the row is already gone', async () => {
            const handler = await build(DeleteProgramResourceHandler);
            repo.findResourceById.mockResolvedValue(null);
            repo.deleteResource.mockResolvedValue(undefined);

            await handler.execute(new DeleteProgramResourceCommand('res-missing', 'user-1'));

            expect(landingCacheInvalidation.invalidate).not.toHaveBeenCalled();
            expect(cache.invalidateByPatterns).not.toHaveBeenCalled();
        });
    });

    // Gap: pricing tier / validity-period / payment-info mutations cleared the
    // Redis + Postgres snapshot layers via invalidatePricingTierCachesByProgramId
    // / invalidatePricingTierCachesByPricingTierId, but neither helper ever fired
    // LandingRevalidationService, so a pricing edit cleared every API-side cache
    // and still left the public page stale until TTL. clearSnapshot/bustProgramCache
    // are false below because those layers are already cleared a few lines above
    // the new revalidation call inside the same helper — see manage-program-content.handlers.ts.
    describe('Pricing tier & payment-info handlers fire the frontend revalidation hook', () => {
        let repo: any;
        let prisma: any;
        let cache: any;
        let landingCacheInvalidation: any;

        const revalidateOptions = {
            clearSnapshot: false,
            bustProgramCache: false,
            swallowErrors: true,
            revalidate: { kind: 'homeAndSettings' as const },
        };

        beforeEach(() => {
            repo = {
                createPricingTier: jest.fn(),
                updatePricingTier: jest.fn(),
                findPricingTierById: jest.fn(),
                deletePricingTier: jest.fn(),
                findPricingTiersByProgramId: jest.fn().mockResolvedValue([]),
            };
            prisma = {
                program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-p' }) },
                brandLandingSnapshot: { deleteMany: jest.fn().mockResolvedValue(undefined) },
            };
            cache = {
                invalidateBrandLandingCaches: jest.fn().mockResolvedValue(undefined),
                invalidateByPattern: jest.fn().mockResolvedValue(undefined),
            };
            landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
        });

        it('CreateProgramPricingTierHandler fires revalidation after creating', async () => {
            const handler = new CreateProgramPricingTierHandler(repo, prisma, cache, landingCacheInvalidation);
            repo.createPricingTier.mockResolvedValue({ id: 'tier-1', programId: 'prog-1' });

            await handler.execute(new CreateProgramPricingTierCommand(
                { programId: 'prog-1', name: 'Tier 1', usdPrice: 100, idrPrice: 1500000 } as any,
                'user-1',
            ));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-p', revalidateOptions);
        });

        it('UpdateProgramPricingTierHandler fires revalidation after updating', async () => {
            const handler = new UpdateProgramPricingTierHandler(repo, prisma, cache, landingCacheInvalidation);
            repo.findPricingTierById.mockResolvedValue({
                id: 'tier-1',
                programId: 'prog-1',
                feeType: 'program_fee_1',
                allowedCategories: [],
                isActive: true,
            });
            repo.updatePricingTier.mockResolvedValue({ id: 'tier-1', programId: 'prog-1', name: 'Renamed' });

            await handler.execute(new UpdateProgramPricingTierCommand('tier-1', { name: 'Renamed' } as any, 'user-1'));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-p', revalidateOptions);
        });

        it('DeleteProgramPricingTierHandler fires revalidation after deleting', async () => {
            const handler = new DeleteProgramPricingTierHandler(repo, prisma, cache, landingCacheInvalidation);
            repo.findPricingTierById.mockResolvedValue({ id: 'tier-1', programId: 'prog-1' });
            repo.deletePricingTier.mockResolvedValue(undefined);

            await handler.execute(new DeleteProgramPricingTierCommand('tier-1', 'user-1'));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-p', revalidateOptions);
        });

        it('UpdateProgramPaymentInfoHandler fires revalidation after saving payment info html', async () => {
            const programRepository = {
                findById: jest.fn().mockResolvedValue({ id: 'prog-1', brandId: 'brand-p' }),
                update: jest.fn().mockResolvedValue(undefined),
            };
            const handler = new UpdateProgramPaymentInfoHandler(programRepository as any, prisma, cache, landingCacheInvalidation);

            await handler.execute(new UpdateProgramPaymentInfoCommand('prog-1', { paymentInfoHtml: '<p>Pay here</p>' } as any, 'user-1'));

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-p', revalidateOptions);
        });
    });

    describe('UpdateProgramContactHandler', () => {
        it('replaces all four contact fields and invalidates landing caches', async () => {
            const programRepository = { findById: jest.fn().mockResolvedValue({ id: 'prog-1' }), update: jest.fn().mockResolvedValue({ id: 'prog-1' }) };
            const prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-1' }) } };
            const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
            const handler = new UpdateProgramContactHandler(programRepository as any, prisma as any, landingCacheInvalidation as any);

            await handler.execute(new UpdateProgramContactCommand('prog-1', {
                contactEmail: 'hello@example.com',
                contactPhone: '+62811',
                contactWhatsapp: '62811',
                contactAddress: 'Jakarta',
            }, 'user-1'));

            expect(programRepository.update).toHaveBeenCalledWith('prog-1', {
                contactEmail: 'hello@example.com',
                contactPhone: '+62811',
                contactWhatsapp: '62811',
                contactAddress: 'Jakarta',
            });
            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-1', expect.objectContaining({ revalidate: { kind: 'homeAndSettings' } }));
        });

        it('clears a field when the DTO sends it as undefined/omitted — omitted fields become null, not left unchanged', async () => {
            // Matches UpdateProgramPaymentInfoHandler's documented resolution: this
            // endpoint replaces the whole contact block, it does not patch.
            const programRepository = { findById: jest.fn().mockResolvedValue({ id: 'prog-1' }), update: jest.fn().mockResolvedValue({ id: 'prog-1' }) };
            const prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-1' }) } };
            const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
            const handler = new UpdateProgramContactHandler(programRepository as any, prisma as any, landingCacheInvalidation as any);

            await handler.execute(new UpdateProgramContactCommand('prog-1', { contactEmail: 'hello@example.com' }, 'user-1'));

            expect(programRepository.update).toHaveBeenCalledWith('prog-1', {
                contactEmail: 'hello@example.com',
                contactPhone: null,
                contactWhatsapp: null,
                contactAddress: null,
            });
        });

        it('throws NotFoundException when the program does not exist, without touching the repository update', async () => {
            const programRepository = { findById: jest.fn().mockResolvedValue(null), update: jest.fn() };
            const handler = new UpdateProgramContactHandler(programRepository as any, {} as any, {} as any);
            await expect(handler.execute(new UpdateProgramContactCommand('missing', {}, 'user-1'))).rejects.toBeInstanceOf(NotFoundException);
            expect(programRepository.update).not.toHaveBeenCalled();
        });
    });

    describe('UpdateProgramLandingContentHandler', () => {
        it('merges the patch into the existing landingContent', async () => {
            const programRepository = {
                findById: jest.fn().mockResolvedValue({ id: 'prog-1', landingContent: { benefits: { title: 'Old' } } }),
                update: jest.fn().mockResolvedValue({ id: 'prog-1' }),
            };
            const prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-1' }) } };
            const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
            const handler = new UpdateProgramLandingContentHandler(programRepository as any, prisma as any, landingCacheInvalidation as any);

            await handler.execute(new UpdateProgramLandingContentCommand('prog-1', { patch: { features: [{ title: 'New' }] } } as any, 'user-1'));

            expect(programRepository.update).toHaveBeenCalledWith('prog-1', {
                landingContent: { benefits: { title: 'Old' }, features: [{ title: 'New' }] },
            });
        });

        it('rejects a patch containing a key outside the 7-key allow-list, does not write, and reports a structured code', async () => {
            const programRepository = { findById: jest.fn().mockResolvedValue({ id: 'prog-1', landingContent: {} }), update: jest.fn() };
            const handler = new UpdateProgramLandingContentHandler(programRepository as any, {} as any, {} as any);

            const error = await captureError(
                handler.execute(new UpdateProgramLandingContentCommand('prog-1', { patch: { tagline: 'nope' } } as any, 'user-1')),
            );

            expect(error).toBeInstanceOf(BadRequestException);
            expect((error.getResponse() as { code: string }).code).toBe('unknown_landing_content_key');
            expect(programRepository.update).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when the program does not exist', async () => {
            const programRepository = { findById: jest.fn().mockResolvedValue(null), update: jest.fn() };
            const handler = new UpdateProgramLandingContentHandler(programRepository as any, {} as any, {} as any);
            await expect(
                handler.execute(new UpdateProgramLandingContentCommand('missing', { patch: {} } as any, 'user-1')),
            ).rejects.toBeInstanceOf(NotFoundException);
            expect(programRepository.update).not.toHaveBeenCalled();
        });
    });
});

