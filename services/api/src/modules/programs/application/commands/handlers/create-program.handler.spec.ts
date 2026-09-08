
import { Test, TestingModule } from '@nestjs/testing';
import { CreateProgramHandler } from './create-program.handler';
import { CreateProgramCommand } from '../create-program.command';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { CreateProgramDto } from '../../../presentation/dto/create-program.dto';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';

describe('CreateProgramHandler', () => {
    let handler: CreateProgramHandler;
    let programRepository: any;
    let activityLogRepository: any;

    const mockProgramRepository = {
        create: jest.fn(),
    };

    const mockActivityLogRepository = {
        create: jest.fn(),
    };

    const mockLandingCacheInvalidation = {
        invalidate: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateProgramHandler,
                { provide: 'IProgramRepository', useValue: mockProgramRepository },
                { provide: IUserActivityLogRepository, useValue: mockActivityLogRepository },
                { provide: LandingCacheInvalidationService, useValue: mockLandingCacheInvalidation },
            ],
        }).compile();

        handler = module.get<CreateProgramHandler>(CreateProgramHandler);
        programRepository = module.get('IProgramRepository');
        activityLogRepository = module.get(IUserActivityLogRepository);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should create program and log activity', async () => {
        const dto: CreateProgramDto = {
            name: 'Test Program',
            brandId: 'cat-1',
            year: 2024,
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            applicationDeadline: '2023-12-31',
            slug: 'test-program'
        };
        const command = new CreateProgramCommand(dto, 'user-1');

        mockProgramRepository.create.mockResolvedValue({ 
            id: 'prog-1', 
            ...dto, 
            startDate: new Date(dto.startDate), 
            endDate: new Date(dto.endDate) 
        });

        const result = await handler.execute(command);

        expect(mockProgramRepository.create).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Test Program',
            startDate: expect.any(Date),
            endDate: expect.any(Date)
        }));

        expect(mockActivityLogRepository.create).toHaveBeenCalled();
        expect(result.id).toBe('prog-1');
    });

    it('should auto-generate slug if missing', async () => {
        const dto: CreateProgramDto = {
            name: 'New Adventure 2024',
            brandId: 'cat-1',
            year: 2024,
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            applicationDeadline: '2023-12-31'
        };
        const command = new CreateProgramCommand(dto, 'user-1');

        mockProgramRepository.create.mockImplementation((data) => Promise.resolve({ id: 'prog-1', ...data }));

        const result = await handler.execute(command);

        expect(mockProgramRepository.create).toHaveBeenCalledWith(expect.objectContaining({
            slug: 'new-adventure-2024'
        }));
        expect(result.slug).toBe('new-adventure-2024');
    });

    it('caps the auto-generated slug at 255 chars (Program.slug is VarChar(255))', async () => {
        const longName = 'Word '.repeat(60).trim(); // well over 255 chars once hyphenated
        const dto: CreateProgramDto = {
            name: longName,
            brandId: 'cat-1',
            year: 2024,
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            applicationDeadline: '2023-12-31',
        };
        const command = new CreateProgramCommand(dto, 'user-1');

        mockProgramRepository.create.mockImplementation((data) => Promise.resolve({ id: 'prog-1', ...data }));

        await handler.execute(command);

        const createdSlug = mockProgramRepository.create.mock.calls[0][0].slug as string;
        expect(createdSlug.length).toBeLessThanOrEqual(255);
    });

    // Audit: this handler cleared Redis + the Postgres snapshot directly but
    // never fired LandingRevalidationService, so a newly-created program never
    // showed up on the public landing page until the cache TTL lapsed. Routed
    // through the shared service so it gets all three layers, like update-program.
    it('invalidates landing caches via the shared service with the home+settings revalidate hook', async () => {
        const dto: CreateProgramDto = {
            name: 'Test Program',
            brandId: 'brand-9',
            year: 2024,
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            applicationDeadline: '2023-12-31',
            slug: 'test-program',
        };
        const command = new CreateProgramCommand(dto, 'user-1');

        mockProgramRepository.create.mockResolvedValue({ id: 'prog-1', ...dto });

        await handler.execute(command);

        expect(mockLandingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-9', {
            clearSnapshot: true,
            bustProgramCache: true,
            swallowErrors: true,
            revalidate: { kind: 'homeAndSettings' },
        });
    });

    // Regression guard for the MEYS 7th incident: a program created with
    // isActive true but no explicit status must not default to 'draft'
    // and go invisible on every public query (status !== 'draft' gate).
    it('advances status to published when created with isActive true and no explicit status', async () => {
        const dto: CreateProgramDto = {
            name: 'Test Program',
            brandId: 'brand-1',
            year: 2024,
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            applicationDeadline: '2023-12-31',
            slug: 'test-program',
            isActive: true,
        };
        const command = new CreateProgramCommand(dto, 'user-1');

        mockProgramRepository.create.mockImplementation((data) => Promise.resolve({ id: 'prog-1', ...data }));

        await handler.execute(command);

        expect(mockProgramRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ isActive: true, status: 'published' }),
        );
    });

    it('respects an explicit draft status even when created with isActive true', async () => {
        const dto: CreateProgramDto = {
            name: 'Test Program',
            brandId: 'brand-1',
            year: 2024,
            startDate: '2024-01-01',
            endDate: '2024-01-10',
            applicationDeadline: '2023-12-31',
            slug: 'test-program',
            isActive: true,
            status: 'draft',
        };
        const command = new CreateProgramCommand(dto, 'user-1');

        mockProgramRepository.create.mockImplementation((data) => Promise.resolve({ id: 'prog-1', ...data }));

        await handler.execute(command);

        expect(mockProgramRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ isActive: true, status: 'draft' }),
        );
    });

    // IMPORTANT 5: the update door was closed (update-program.handler.spec.ts's
    // "isPublished guard" describe block) but a direct POST /programs call
    // could still create a program already live, bypassing the readiness
    // engine entirely. isPublished is no longer part of CreateProgramDto's
    // type, but a caller (or an old client build) can still send it over the
    // wire — this must be rejected rather than silently creating a published
    // program that never touched POST /programs/:id/publish.
    describe('isPublished guard (publish moved to POST /programs/:id/publish)', () => {
        it('rejects any payload still carrying isPublished', async () => {
            const dto = {
                name: 'Test Program',
                brandId: 'brand-1',
                year: 2024,
                startDate: '2024-01-01',
                endDate: '2024-01-10',
                applicationDeadline: '2023-12-31',
                slug: 'test-program',
                isPublished: true,
            } as unknown as CreateProgramDto;
            const command = new CreateProgramCommand(dto, 'user-1');

            await expect(handler.execute(command)).rejects.toThrow(
                'isPublished is not accepted on create. Create the program, then use POST /programs/:id/publish.',
            );
            expect(mockProgramRepository.create).not.toHaveBeenCalled();
        });
    });
});
