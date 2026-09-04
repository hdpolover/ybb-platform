
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CreateDeletionRequestHandler } from './create-deletion-request.handler';
import { CreateDeletionRequestCommand } from '../create-deletion-request.command';
import { IAccountDeletionRequestRepository } from '@core/interfaces/repositories/account-deletion-request.repository.interface';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { ConflictException } from '@nestjs/common';
import { DeletionStatus } from '@prisma/client';

describe('CreateDeletionRequestHandler', () => {
    let handler: CreateDeletionRequestHandler;

    const mockRepository = {
        findByUserId: jest.fn(),
        findActiveByUserId: jest.fn(),
    };

    const createdRequest = {
        id: 'req-1',
        userId: 'user-1',
        reason: null,
        reasonCategory: null,
        status: DeletionStatus.approved,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        scheduledDeletionDate: new Date('2026-01-31T00:00:00Z'),
    };

    const mockTx = {
        accountDeletionRequest: { create: jest.fn() },
        user: { update: jest.fn() },
    };

    const mockPrisma = {
        applicationInvoice: { count: jest.fn() },
        participantApplication: { count: jest.fn() },
        user: { findUnique: jest.fn() },
        brand: { findUnique: jest.fn() },
        participant: { findUnique: jest.fn() },
        $transaction: jest.fn(),
    };

    const mockConfigService = { get: jest.fn(() => 'https://example.ybb.id') };
    const mockRabbitmqProducer = { emit: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateDeletionRequestHandler,
                { provide: IAccountDeletionRequestRepository, useValue: mockRepository },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: RabbitMQProducerService, useValue: mockRabbitmqProducer },
            ],
        }).compile();

        handler = module.get<CreateDeletionRequestHandler>(CreateDeletionRequestHandler);
        jest.clearAllMocks();

        // Happy-path defaults.
        mockRepository.findActiveByUserId.mockResolvedValue(null);
        mockPrisma.applicationInvoice.count.mockResolvedValue(0);
        mockPrisma.participantApplication.count.mockResolvedValue(0);
        mockTx.accountDeletionRequest.create.mockResolvedValue(createdRequest);
        mockTx.user.update.mockResolvedValue({});
        mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockTx));
        mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'real.person@example.com', brandId: 'brand-1' });
        mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'YBB', websiteUrl: 'https://ybb.example' });
        mockPrisma.participant.findUnique.mockResolvedValue({ fullName: 'Jane Doe' });
        mockRabbitmqProducer.emit.mockResolvedValue(undefined);
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('auto-schedules the request (no admin approval gate) and deactivates the account immediately', async () => {
        const command = new CreateDeletionRequestCommand('user-1', { reason: 'privacy' }, '127.0.0.1', 'Mozilla/5.0');

        const result = await handler.execute(command);

        expect(mockTx.accountDeletionRequest.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                status: DeletionStatus.approved,
                scheduledDeletionDate: expect.any(Date),
                dataSnapshot: expect.objectContaining({
                    cancellationTokenHash: expect.any(String),
                    cancellationTokenExpiresAt: expect.any(String),
                }),
            }),
        });
        expect(mockTx.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { isActive: false } });
        expect(result.id).toBe('req-1');
        expect(result.status).toBe(DeletionStatus.approved);
        expect(result.scheduledDeletionDate).toEqual(createdRequest.scheduledDeletionDate);
    });

    it('never stores the raw cancellation token - only its hash', async () => {
        const command = new CreateDeletionRequestCommand('user-1', {});
        await handler.execute(command);

        const writtenData = mockTx.accountDeletionRequest.create.mock.calls[0][0].data;
        const rawTokenFromEmail = mockRabbitmqProducer.emit.mock.calls[0][1].cancelUrl.match(/token=([^&]+)/)[1];

        expect(writtenData.dataSnapshot.cancellationTokenHash).not.toBe(rawTokenFromEmail);
        expect(writtenData.dataSnapshot.cancellationTokenHash).toHaveLength(64); // sha256 hex
    });

    it('emits user.account-deletion-requested with a cancel link and the exact completion date that was persisted', async () => {
        const command = new CreateDeletionRequestCommand('user-1', {});
        await handler.execute(command);

        // The persisted scheduledDeletionDate (what the tx.create call wrote)
        // must be the SAME value quoted in the email, not independently
        // recomputed - a caller comparing the two dates in the DB vs. the
        // email must never see them drift.
        const persistedDate: Date = mockTx.accountDeletionRequest.create.mock.calls[0][0].data.scheduledDeletionDate;

        expect(mockRabbitmqProducer.emit).toHaveBeenCalledWith('user.account-deletion-requested', expect.objectContaining({
            email: 'real.person@example.com',
            name: 'Jane Doe',
            cancelUrl: expect.stringContaining('requestId=req-1'),
            scheduledDeletionDate: persistedDate.toISOString(),
        }));
    });

    it('throws ConflictException if an active (pending or approved) request already exists', async () => {
        mockRepository.findActiveByUserId.mockResolvedValue({ id: 'existing-1', status: DeletionStatus.approved });

        const command = new CreateDeletionRequestCommand('user-1', {});
        await expect(handler.execute(command)).rejects.toThrow(ConflictException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('does NOT block on a paid invoice - it is reported as a consequence instead', async () => {
        mockPrisma.applicationInvoice.count.mockResolvedValue(3);

        const command = new CreateDeletionRequestCommand('user-1', {});
        const result = await handler.execute(command);

        expect(result.consequences).toEqual(expect.objectContaining({ hasPaidInvoice: true, paidInvoiceCount: 3 }));
        expect(mockTx.accountDeletionRequest.create).toHaveBeenCalled(); // never refused
    });

    it('does NOT block on a non-draft application - it is reported as a consequence instead', async () => {
        mockPrisma.participantApplication.count.mockResolvedValue(2);

        const command = new CreateDeletionRequestCommand('user-1', {});
        const result = await handler.execute(command);

        expect(result.consequences).toEqual(expect.objectContaining({ hasNonDraftApplication: true, nonDraftApplicationCount: 2 }));
        expect(mockTx.accountDeletionRequest.create).toHaveBeenCalled();
    });

    it('reports no consequences for a draft-only user with no paid invoice', async () => {
        mockPrisma.applicationInvoice.count.mockResolvedValue(0);
        mockPrisma.participantApplication.count.mockResolvedValue(0);

        const command = new CreateDeletionRequestCommand('user-1', {});
        const result = await handler.execute(command);

        expect(result.consequences).toEqual({
            hasPaidInvoice: false,
            paidInvoiceCount: 0,
            hasNonDraftApplication: false,
            nonDraftApplicationCount: 0,
        });
    });

    it('counts non-draft applications by excluding only draft, not the old narrower in-flight list', async () => {
        const command = new CreateDeletionRequestCommand('user-1', {});
        await handler.execute(command);

        expect(mockPrisma.participantApplication.count).toHaveBeenCalledWith({
            where: {
                participant: { userId: 'user-1' },
                status: { not: 'draft' },
            },
        });
    });
});
