
import { Test, TestingModule } from '@nestjs/testing';
import { GetUserHandler } from './get-user.handler';
import { GetUserQuery } from '../get-user.query';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { NotFoundException } from '@nestjs/common';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { User } from '@core/entities/user.entity';

describe('GetUserHandler', () => {
    let handler: GetUserHandler;
    let userRepository: any; // using any for simplicity with complex interfaces
    let cacheService: CacheService;

    const mockUserRepository = {
        findById: jest.fn(),
    };

    const mockCacheService = {
        get: jest.fn(),
        set: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetUserHandler,
                { provide: IUserRepository, useValue: mockUserRepository },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        handler = module.get<GetUserHandler>(GetUserHandler);
        userRepository = module.get(IUserRepository);
        cacheService = module.get<CacheService>(CacheService);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should return cached user if available', async () => {
        const query = new GetUserQuery('user-1', 'brand-1');
        const cachedUser = { id: 'user-1', email: 'test@example.com' };
        
        mockCacheService.get.mockResolvedValue(cachedUser);

        const result = await handler.execute(query);

        expect(result).toBe(cachedUser);
        expect(mockCacheService.get).toHaveBeenCalledWith(CACHE_KEYS.USER('user-1'));
        expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from repository if cache miss, then cache and return DTO', async () => {
        const query = new GetUserQuery('user-1', 'brand-1');
        const userEntity: User = {
            id: 'user-1',
            brandId: 'brand-1',
            email: 'test@example.com',
            isActive: true,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            passwordHash: 'hash',
            role: 'USER',
            // ... other fields
        } as unknown as User;

        mockCacheService.get.mockResolvedValue(null);
        mockUserRepository.findById.mockResolvedValue(userEntity);

        const result = await handler.execute(query);

        expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1', 'brand-1');
        expect(mockCacheService.set).toHaveBeenCalledWith(
            CACHE_KEYS.USER('user-1'),
            expect.objectContaining({ id: 'user-1' }),
            expect.anything() // TTL
        );
        expect(result.id).toBe('user-1');
        expect(result.email).toBe('test@example.com');
    });

    it('should throw NotFoundException if user not found', async () => {
        const query = new GetUserQuery('unknown', 'brand-1');

        mockCacheService.get.mockResolvedValue(null);
        mockUserRepository.findById.mockResolvedValue(null);

        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
    });
});
