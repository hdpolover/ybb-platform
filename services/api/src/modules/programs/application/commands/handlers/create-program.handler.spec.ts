
import { Test, TestingModule } from '@nestjs/testing';
import { CreateProgramHandler } from './create-program.handler';
import { CreateProgramCommand } from '../create-program.command';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { CreateProgramDto } from '../../../presentation/dto/create-program.dto';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';

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

    const mockCacheService = {
        invalidateBrandLandingCaches: jest.fn().mockResolvedValue(undefined),
        invalidateByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateProgramHandler,
                { provide: 'IProgramRepository', useValue: mockProgramRepository },
                { provide: IUserActivityLogRepository, useValue: mockActivityLogRepository },
                { provide: CacheService, useValue: mockCacheService },
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
});
