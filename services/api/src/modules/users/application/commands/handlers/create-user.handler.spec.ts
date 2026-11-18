
import { Test, TestingModule } from '@nestjs/testing';
import { CreateUserHandler } from './create-user.handler';
import { CreateUserCommand } from '../create-user.command';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('hashed_password'),
}));

describe('CreateUserHandler', () => {
    let handler: CreateUserHandler;
    let repository: any;
    let rabbitmq: any;

    const mockRepository = {
        exists: jest.fn(),
        create: jest.fn(),
    };

    const mockRabbitMQ = {
        emit: jest.fn(),
        emitSafe: jest.fn().mockResolvedValue(true),
    };

    const brandRow = {
        id: 'brand-1',
        name: 'Istanbul Youth Summit',
        primaryColor: '#886B02',
        logoUrl: null,
        websiteUrl: 'https://istanbulyouthsummit.com',
        socialMediaLinks: null,
        settings: null,
    };

    const mockPrisma = {
        brand: { findUnique: jest.fn() },
    };

    const mockCacheService = {
        invalidateByPattern: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateUserHandler,
                { provide: IUserRepository, useValue: mockRepository },
                { provide: RabbitMQProducerService, useValue: mockRabbitMQ },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        handler = module.get<CreateUserHandler>(CreateUserHandler);
        repository = module.get(IUserRepository);
        rabbitmq = module.get<RabbitMQProducerService>(RabbitMQProducerService);

        jest.clearAllMocks();
        mockPrisma.brand.findUnique.mockResolvedValue(brandRow);
    });

    it('should create user and emit event', async () => {
        const command = new CreateUserCommand('brand-1', 'test@example.com', 'password');
        
        mockRepository.exists.mockResolvedValue(false);
        mockRepository.create.mockImplementation((u) => Promise.resolve({ ...u, id: 'user-1' }));

        const result = await handler.execute(command);

        expect(mockRepository.exists).toHaveBeenCalledWith('test@example.com', 'brand-1');
        expect(mockRepository.create).toHaveBeenCalled();
        expect(mockRabbitMQ.emitSafe).toHaveBeenCalledWith('user.registered', {
            email: 'test@example.com',
            name: 'User',
            brand: expect.objectContaining({
                name: 'Istanbul Youth Summit',
                websiteUrl: 'https://istanbulyouthsummit.com',
            }),
        });
        expect(mockPrisma.brand.findUnique).toHaveBeenCalledWith({
            where: { id: 'brand-1' },
            include: { settings: true },
        });
        expect(result.id).toBe('user-1');
    });

    it('still creates the user and emits an unbranded event when the brand lookup fails', async () => {
        const command = new CreateUserCommand('brand-1', 'test@example.com', 'password');
        mockRepository.exists.mockResolvedValue(false);
        mockRepository.create.mockImplementation((u) => Promise.resolve({ ...u, id: 'user-1' }));
        mockPrisma.brand.findUnique.mockRejectedValueOnce(new Error('db down'));

        await expect(handler.execute(command)).resolves.toMatchObject({ id: 'user-1' });
        expect(mockRabbitMQ.emitSafe).toHaveBeenCalledWith('user.registered', {
            email: 'test@example.com',
            name: 'User',
            brand: null,
        });
    });

    it('should throw ConflictException if user exists', async () => {
        const command = new CreateUserCommand('brand-1', 'test@example.com', 'password');

        mockRepository.exists.mockResolvedValue(true);

        await expect(handler.execute(command)).rejects.toThrow(ConflictException);
        expect(mockRepository.create).not.toHaveBeenCalled();
        expect(mockRabbitMQ.emitSafe).not.toHaveBeenCalled();
    });
});
