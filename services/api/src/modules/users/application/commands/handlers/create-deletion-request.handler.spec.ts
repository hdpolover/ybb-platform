
import { Test, TestingModule } from '@nestjs/testing';
import { CreateDeletionRequestHandler } from './create-deletion-request.handler';
import { CreateDeletionRequestCommand } from '../create-deletion-request.command';
import { IAccountDeletionRequestRepository } from '@core/interfaces/repositories/account-deletion-request.repository.interface';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ConflictException, HttpException } from '@nestjs/common';
import { ApplicationStatus } from '@core/entities/participant-application.entity';

// BadRequestException/ConflictException here carry a structured
// { code, message } response body, and Nest's HttpException surfaces that
// body's own `message` string as the thrown error's `.message` — not the
// `code`. Asserting on `.getResponse().code` is this codebase's established
// way to check a structured exception's code (see
// manage-program-content.handlers.spec.ts, rundowns.copier.spec.ts).
async function captureError(promise: Promise<unknown>): Promise<HttpException> {
    try {
        await promise;
    } catch (err) {
        return err as HttpException;
    }
    throw new Error('expected promise to reject');
}

describe('CreateDeletionRequestHandler', () => {
    let handler: CreateDeletionRequestHandler;

    const mockRepository = {
        findPendingByUserId: jest.fn(),
        create: jest.fn(),
    };

    const mockPrisma = {
        applicationInvoice: { findFirst: jest.fn() },
        participantApplication: { findFirst: jest.fn() },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateDeletionRequestHandler,
                { provide: IAccountDeletionRequestRepository, useValue: mockRepository },
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        handler = module.get<CreateDeletionRequestHandler>(CreateDeletionRequestHandler);
        jest.clearAllMocks();

        // Happy-path defaults: no pending request, no paid invoice, no in-flight application.
        mockRepository.findPendingByUserId.mockResolvedValue(null);
        mockRepository.create.mockImplementation((req) => Promise.resolve({ ...req, id: 'req-1' }));
        mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);
        mockPrisma.participantApplication.findFirst.mockResolvedValue(null);
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

    it('blocks deletion when the user has a paid invoice, with a machine-readable code', async () => {
        mockPrisma.applicationInvoice.findFirst.mockResolvedValue({ id: 'invoice-1' });

        const command = new CreateDeletionRequestCommand('user-1', {});
        const error = await captureError(handler.execute(command));

        expect(error).toBeInstanceOf(ConflictException);
        expect(error.getStatus()).toBe(409);
        expect((error.getResponse() as { code: string }).code).toBe('paid_invoice_exists');
        expect(mockRepository.create).not.toHaveBeenCalled();
        expect(mockPrisma.applicationInvoice.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: 'paid',
                    application: { participant: { userId: 'user-1' } },
                }),
            }),
        );
    });

    it.each([
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.UNDER_REVIEW,
        ApplicationStatus.INTERVIEW_SCHEDULED,
        ApplicationStatus.ACCEPTED,
        ApplicationStatus.WAITLISTED,
    ])('blocks deletion when an application is in status "%s"', async (status) => {
        mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', status });

        const command = new CreateDeletionRequestCommand('user-1', {});
        const error = await captureError(handler.execute(command));

        expect(error).toBeInstanceOf(ConflictException);
        expect(error.getStatus()).toBe(409);
        expect((error.getResponse() as { code: string }).code).toBe('application_in_progress');
        expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('allows deletion for a user with only a draft application and no paid invoice', async () => {
        // draft is not in the blocking set, so the query legitimately returns nothing.
        mockPrisma.participantApplication.findFirst.mockResolvedValue(null);
        mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);

        const command = new CreateDeletionRequestCommand('user-1', {});

        const result = await handler.execute(command);

        expect(result.id).toBe('req-1');
        expect(mockRepository.create).toHaveBeenCalled();
    });
});
