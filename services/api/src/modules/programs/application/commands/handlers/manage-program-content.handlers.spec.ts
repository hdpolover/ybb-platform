
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
    CreateProgramEssayHandler,
    CreateProgramSpeakerHandler,
    DeleteProgramEssayHandler,
    UpdateProgramEssayHandler,
    UpdateProgramSpeakerHandler,
    CreateValidityPeriodHandler,
    UpdateValidityPeriodHandler,
} from './manage-program-content.handlers';
import {
    CreateProgramEssayCommand,
    CreateProgramSpeakerCommand,
    DeleteProgramEssayCommand,
    UpdateProgramEssayCommand,
    UpdateProgramSpeakerCommand,
    CreateValidityPeriodCommand,
    UpdateValidityPeriodCommand,
} from '../program-content.commands';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { StorageService } from '../../../../files/application/storage.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

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
        });

        async function buildModule<T>(HandlerCtor: new (...args: any[]) => T): Promise<T> {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    HandlerCtor,
                    { provide: 'IProgramContentRepository', useValue: vpRepository },
                    { provide: PrismaService, useValue: vpPrisma },
                    { provide: CacheService, useValue: vpCache },
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
    });
});

