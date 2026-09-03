
import { Test, TestingModule } from '@nestjs/testing';
import { GetUserHandler } from './get-user.handler';
import { GetUserQuery } from '../get-user.query';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
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

    const mockPrismaService = {
        user: {
            findUnique: jest.fn().mockResolvedValue(null),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetUserHandler,
                { provide: IUserRepository, useValue: mockUserRepository },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PrismaService, useValue: mockPrismaService },
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
        // A real UserResponseDto carries brandId; the cache hit is now checked
        // against the brand the controller authorised.
        const cachedUser = { id: 'user-1', email: 'test@example.com', brandId: 'brand-1' };

        mockCacheService.get.mockResolvedValue(cachedUser);

        const result = await handler.execute(query);

        expect(result).toBe(cachedUser);
        expect(mockCacheService.get).toHaveBeenCalledWith(CACHE_KEYS.USER('user-1'));
        expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    // The cache key is the user id alone, so before this a warm entry was
    // returned before findById's brand filter ever ran - handing another brand's
    // user to an admin the controller had only authorised for their own.
    it('does NOT serve a cached user belonging to a brand the caller was not scoped to', async () => {
        const query = new GetUserQuery('user-1', 'brand-1');
        mockCacheService.get.mockResolvedValue({ id: 'user-1', email: 'x@y.z', brandId: 'brand-other' });
        mockUserRepository.findById.mockResolvedValue(null);

        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
        // Falls through to the brand-filtered repository read rather than
        // returning the cached row.
        expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1', 'brand-1');
    });

    it('still serves any cached user to a platform admin, who has no brand filter', async () => {
        const query = new GetUserQuery('user-1', undefined);
        const cachedUser = { id: 'user-1', email: 'x@y.z', brandId: 'brand-other' };
        mockCacheService.get.mockResolvedValue(cachedUser);

        await expect(handler.execute(query)).resolves.toBe(cachedUser);
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
