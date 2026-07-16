
import { Test, TestingModule } from '@nestjs/testing';
import { CreateDeletionRequestHandler } from './create-deletion-request.handler';
import { CreateDeletionRequestCommand } from '../create-deletion-request.command';
import { IAccountDeletionRequestRepository } from '@core/interfaces/repositories/account-deletion-request.repository.interface';
import { AccountDeletionRequest } from '@core/entities/account-deletion-request.entity';
import { ConflictException } from '@nestjs/common';

describe('CreateDeletionRequestHandler', () => {
    let handler: CreateDeletionRequestHandler;
    let repository: any;

    const mockRepository = {
        findPendingByUserId: jest.fn(),
        create: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateDeletionRequestHandler,
                { provide: IAccountDeletionRequestRepository, useValue: mockRepository },
            ],
        }).compile();

        handler = module.get<CreateDeletionRequestHandler>(CreateDeletionRequestHandler);
        repository = module.get(IAccountDeletionRequestRepository);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should create request if no pending request exists', async () => {
        const command = new CreateDeletionRequestCommand(
            'user-1',
            { reason: 'privacy', reasonCategory: 'gdpr' },
            '127.0.0.1',
            'Mozilla/5.0'
        );

        mockRepository.findPendingByUserId.mockResolvedValue(null);
        mockRepository.create.mockImplementation((req) => Promise.resolve({ ...req, id: 'req-1' }));

        const result = await handler.execute(command);

        expect(mockRepository.findPendingByUserId).toHaveBeenCalledWith('user-1');
        expect(mockRepository.create).toHaveBeenCalled();
        const createdReq = mockRepository.create.mock.calls[0][0];
        expect(createdReq.userId).toBe('user-1');
        expect(createdReq.ipAddress).toBe('127.0.0.1');
        expect(result.id).toBe('req-1');
        expect(result.status).toBe('pending');
    });

    it('should throw ConflictException if pending request exists', async () => {
        const command = new CreateDeletionRequestCommand('user-1', {});
        
        mockRepository.findPendingByUserId.mockResolvedValue({ id: 'existing-1', status: 'pending' });

        await expect(handler.execute(command)).rejects.toThrow(ConflictException);
        expect(mockRepository.create).not.toHaveBeenCalled();
    });
});
