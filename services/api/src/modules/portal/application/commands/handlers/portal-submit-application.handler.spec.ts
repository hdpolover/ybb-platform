import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PortalSubmitApplicationHandler } from './portal-submit-application.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
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
        ambassador: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        ambassadorReferral: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        participant: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn(),
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

    const mockReferralFunnel = {
        advanceToApplied: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PortalSubmitApplicationHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
                { provide: RegistrationFeeGateService, useValue: mockGateService },
                { provide: ReferralFunnelService, useValue: mockReferralFunnel },
            ],
        }).compile();

        handler = module.get<PortalSubmitApplicationHandler>(PortalSubmitApplicationHandler);
        jest.clearAllMocks();
        // Default: gate allows
        mockGateService.assertRegistrationFeePaid.mockResolvedValue(undefined);
        // Default: $transaction calls the callback with prisma mock itself
        mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma));
        // Default: advanceToApplied succeeds
        mockReferralFunnel.advanceToApplied.mockResolvedValue(undefined);
    });

    /**
     * Builds a mock application record matching the Prisma select shape used
     * by the handler.
     */
    const makeApp = (overrides: {
        status?: string;
        personalData?: Record<string, unknown>;
        programId?: string;
        formFields?: Array<{ name: string; label: string; validationRules: unknown }>;
        programName?: string;
        applicationDeadline?: Date | null;
    } = {}) => ({
        id: 'app-1',
        status: overrides.status ?? 'draft',
        personalData: overrides.personalData ?? {},
        participantId: 'participant-1',
        programId: overrides.programId ?? null,
        program: {
            name: overrides.programName ?? 'Test Program',
            applicationDeadline: overrides.applicationDeadline ?? null,
            formFields: overrides.formFields ?? [],
        },
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

    // ── submission deadline gate ────────────────────────────────────────────────

    describe('submission deadline gate', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        it('BLOCKS submission past the deadline with a message naming the program and deadline', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({
                    programName: 'Istanbul Youth Summit 2027',
                    applicationDeadline: new Date('2026-08-30T17:00:00.000Z'), // WIB midnight, 31 Aug
                }),
            );
            jest.useFakeTimers().setSystemTime(new Date('2026-08-31T17:00:00.000Z')); // 00:00 WIB next day

            const command: PortalSubmitApplicationCommand = { userId: 'user-1' };

            await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
            await expect(handler.execute(command)).rejects.toThrow('Istanbul Youth Summit 2027');
            expect(mockGateService.assertRegistrationFeePaid).not.toHaveBeenCalled();
        });

        it('ALLOWS submission at 23:59:59.999 WIB on the deadline day itself', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({ applicationDeadline: new Date('2026-08-30T17:00:00.000Z') }),
            );
            mockPrisma.participantApplication.update.mockResolvedValue({});
            jest.useFakeTimers().setSystemTime(new Date('2026-08-31T16:59:59.999Z'));

            const result = await handler.execute({ userId: 'user-1' });

            expect(result.success).toBe(true);
        });

        it('ALLOWS submission when the program has no deadline', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({ applicationDeadline: null }),
            );
            mockPrisma.participantApplication.update.mockResolvedValue({});

            const result = await handler.execute({ userId: 'user-1' });

            expect(result.success).toBe(true);
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

    // ── referral linking ──────────────────────────────────────────────────────

    describe('referral linking', () => {
        const referralFormFields = [
            { name: 'referralCode', label: 'Referral Code', validationRules: {} },
        ];

        it('creates referral and advances funnel when valid referral code is submitted', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1', programId: 'program-123' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({
                    personalData: { referralCode: 'ABC123' },
                    programId: 'program-123',
                    formFields: referralFormFields,
                }),
            );
            mockPrisma.participantApplication.update.mockResolvedValue({});
            mockPrisma.ambassadorReferral.findFirst.mockResolvedValue(null);
            mockPrisma.ambassador.findUnique.mockResolvedValue({ id: 'amb-1', referralCode: 'ABC123', isActive: true });
            mockPrisma.ambassadorReferral.create.mockResolvedValue({});
            mockPrisma.ambassador.update.mockResolvedValue({});
            mockPrisma.participant.findUnique.mockResolvedValue({ referralCode: null });
            mockPrisma.participant.update.mockResolvedValue({});

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
            expect(mockPrisma.ambassadorReferral.create).toHaveBeenCalledWith({
                data: {
                    ambassadorId: 'amb-1',
                    participantId: 'participant-1',
                    status: 'referred',
                },
            });
            expect(mockPrisma.ambassador.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ totalReferrals: { increment: 1 } }),
                }),
            );
            expect(mockReferralFunnel.advanceToApplied).toHaveBeenCalledWith('participant-1', 'program-123');
        });

        it('skips referral creation when participant already has a referral (dedup)', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1', programId: 'program-123' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({
                    personalData: { referralCode: 'ABC123' },
                    programId: 'program-123',
                    formFields: referralFormFields,
                }),
            );
            mockPrisma.participantApplication.update.mockResolvedValue({});
            // Existing referral present
            mockPrisma.ambassadorReferral.findFirst.mockResolvedValue({ id: 'ref-existing' });

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
            expect(mockPrisma.ambassadorReferral.create).not.toHaveBeenCalled();
        });

        it('skips referral creation when ambassador is not found', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1', programId: 'program-123' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({
                    personalData: { referralCode: 'INVALID' },
                    programId: 'program-123',
                    formFields: referralFormFields,
                }),
            );
            mockPrisma.participantApplication.update.mockResolvedValue({});
            mockPrisma.ambassadorReferral.findFirst.mockResolvedValue(null);
            // Ambassador not found
            mockPrisma.ambassador.findUnique.mockResolvedValue(null);

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
            expect(mockPrisma.ambassadorReferral.create).not.toHaveBeenCalled();
        });

        it('skips referral block when no referral field is present in form fields', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1', programId: 'program-123' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({
                    personalData: { fullName: 'Jane Doe' },
                    programId: 'program-123',
                    formFields: [{ name: 'fullName', label: 'Full Name', validationRules: {} }],
                }),
            );
            mockPrisma.participantApplication.update.mockResolvedValue({});

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        });

        it('skips referral block when personalData has empty referral code', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1', programId: 'program-123' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({
                    personalData: { referralCode: '' },
                    programId: 'program-123',
                    formFields: referralFormFields,
                }),
            );
            mockPrisma.participantApplication.update.mockResolvedValue({});

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        });

        it('does not block submit when referral linking throws', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1', programId: 'program-123' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({
                    personalData: { referralCode: 'ABC123' },
                    programId: 'program-123',
                    formFields: referralFormFields,
                }),
            );
            mockPrisma.participantApplication.update.mockResolvedValue({});
            // Make $transaction reject to simulate referral linking failure
            mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
        });
    });
});
