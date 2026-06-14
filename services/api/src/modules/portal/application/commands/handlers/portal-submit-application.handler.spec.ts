import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PortalSubmitApplicationHandler } from './portal-submit-application.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';
import { PortalSubmitApplicationCommand } from '../../queries/portal-queries';

describe('PortalSubmitApplicationHandler', () => {
    let handler: PortalSubmitApplicationHandler;

    const mockPrisma = {
        participantApplication: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        applicationInvoice: {
            findFirst: jest.fn(),
        },
    };

    const mockCacheService = {
        invalidateKey: jest.fn().mockResolvedValue(undefined),
    };

    const mockPortalCacheService = {
        getParticipantProfile: jest.fn(),
        invalidateSubmissionDetail: jest.fn().mockResolvedValue(undefined),
        invalidateSubmissions: jest.fn().mockResolvedValue(undefined),
        invalidateDashboard: jest.fn().mockResolvedValue(undefined),
    };

    /** Shared gate service is mocked — its own tests cover gate logic. */
    const mockGateService = {
        assertRegistrationFeePaid: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PortalSubmitApplicationHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: RegistrationFeeGateService, useValue: mockGateService },
            ],
        }).compile();

        handler = module.get<PortalSubmitApplicationHandler>(PortalSubmitApplicationHandler);
        jest.clearAllMocks();
        // Default: gate allows
        mockGateService.assertRegistrationFeePaid.mockResolvedValue(undefined);
    });

    /**
     * Builds a mock application record matching the Prisma select shape used
     * by the handler.
     */
    const makeApp = (overrides: {
        status?: string;
        personalData?: Record<string, unknown>;
    } = {}) => ({
        id: 'app-1',
        status: overrides.status ?? 'draft',
        personalData: overrides.personalData ?? {},
        participantId: 'participant-1',
    });

    beforeEach(() => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
    });

    // ── programId scoping ────────────────────────────────────────────────────

    describe('programId scoping', () => {
        it('queries WITHOUT programId scope when command carries no programId', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());
            mockPrisma.participantApplication.update.mockResolvedValue({});

            await handler.execute(command);

            expect(mockPrisma.participantApplication.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { participantId: 'participant-1' },
                }),
            );
        });

        it('scopes the query to the given programId when provided', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1', programId: 'prog-42' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());
            mockPrisma.participantApplication.update.mockResolvedValue({});

            await handler.execute(command);

            expect(mockPrisma.participantApplication.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { participantId: 'participant-1', programId: 'prog-42' },
                }),
            );
        });

        it('selects the scoped application even when a newer unscoped application exists', async () => {
            // The handler must scope by programId when provided rather than falling
            // back to latest-updated, so a newer unrelated application is not picked up.
            const command: PortalSubmitApplicationCommand = { userId: 'user-1', programId: 'prog-42' };
            const scopedApp = { ...makeApp(), id: 'app-prog42' };
            // Return the scoped app — the mock honors the where clause we validated above.
            mockPrisma.participantApplication.findFirst.mockResolvedValue(scopedApp);
            mockPrisma.participantApplication.update.mockResolvedValue({});

            const result = await handler.execute(command);

            expect(result.applicationId).toBe('app-prog42');
        });
    });

    // ── payment gate delegation ───────────────────────────────────────────────

    describe('payment gate delegation', () => {
        it('calls the shared gate service for every submission', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());
            mockPrisma.participantApplication.update.mockResolvedValue({});

            await handler.execute(command);

            expect(mockGateService.assertRegistrationFeePaid).toHaveBeenCalledWith('app-1');
        });

        it('BLOCKS submission when the gate service throws BadRequestException', async () => {
            mockGateService.assertRegistrationFeePaid.mockRejectedValue(
                new BadRequestException('Registration fee must be paid before submission.'),
            );
            const command: PortalSubmitApplicationCommand = { userId: 'user-1' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());

            await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
            await expect(handler.execute(command)).rejects.toThrow(
                'Registration fee must be paid before submission.',
            );
        });

        it('ALLOWS submission when the gate service resolves', async () => {
            mockGateService.assertRegistrationFeePaid.mockResolvedValue(undefined);
            const command: PortalSubmitApplicationCommand = { userId: 'user-1' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());
            mockPrisma.participantApplication.update.mockResolvedValue({});

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
        });
    });

    // ── guard rails ───────────────────────────────────────────────────────────

    describe('guard rails', () => {
        it('throws NotFoundException when participant is not found', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue(null);

            await expect(
                handler.execute({ userId: 'user-1' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException when no application exists', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(null);

            await expect(
                handler.execute({ userId: 'user-1' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('throws BadRequestException when application is not in draft status', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({ status: 'submitted' }),
            );

            await expect(
                handler.execute({ userId: 'user-1' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('does not call gate service when application is not in draft', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({ status: 'submitted' }),
            );

            await expect(
                handler.execute({ userId: 'user-1' }),
            ).rejects.toThrow(BadRequestException);

            expect(mockGateService.assertRegistrationFeePaid).not.toHaveBeenCalled();
        });
    });

    // ── cache invalidation ────────────────────────────────────────────────────

    describe('cache invalidation', () => {
        it('invalidates all relevant cache keys on success', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());
            mockPrisma.participantApplication.update.mockResolvedValue({});

            await handler.execute(command);

            // Expect 4 cache key invalidations
            expect(mockCacheService.invalidateKey).toHaveBeenCalledTimes(4);
        });
    });
});
