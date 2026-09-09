import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PortalSubmitApplicationHandler } from './portal-submit-application.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
import { PortalSubmitApplicationCommand } from '../../queries/portal-queries';
import { makePrismaTxMock, expectNoOuterWrites } from '@test/utils/prisma-tx-mock';

describe('PortalSubmitApplicationHandler', () => {
    let handler: PortalSubmitApplicationHandler;

    // Disjoint prisma/tx mocks. The referral block (ambassadorReferral.*,
    // ambassador.*, participant.*) runs inside `this.prisma.$transaction`, so
    // those mocks live ONLY on `mockTx`. If a referral write regresses onto
    // `mockPrisma` (outside the transaction's rollback boundary), the
    // `expectNoOuterWrites({ ambassador: mockPrisma.ambassador })` guard below
    // catches it instead of passing either way. Scoped to `ambassador` only
    // (not the full `mockPrisma`) because `participantApplication.updateMany`
    // is a *legitimate* outer write here -- the submit-status update happens
    // outside the referral transaction by design.
    const { prisma: mockPrisma, tx: mockTx } = makePrismaTxMock(
        {
            participantApplication: {
                findFirst: jest.fn(),
                updateMany: jest.fn(),
            },
            applicationInvoice: {
                findFirst: jest.fn(),
            },
            ambassador: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        },
        {
            ambassadorReferral: {
                findFirst: jest.fn(),
                create: jest.fn(),
            },
            ambassador: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            participant: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        },
    );

    const mockCacheService = {
        invalidateKey: jest.fn().mockResolvedValue(undefined),
        invalidatePortalCache: jest.fn().mockResolvedValue(undefined),
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
        // Default: the submit write wins the race (count 1) - individual tests
        // override to {count: 0} to exercise the double-submit path.
        mockPrisma.participantApplication.updateMany.mockResolvedValue({ count: 1 });
        // Default: $transaction calls the callback with the disjoint tx mock (never
        // the outer mockPrisma -- see makePrismaTxMock's docstring for why).
        mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));
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

            await handler.execute(command);

            // Reads and writes now share one rule, so the write clause also
            // excludes soft-deleted rows and orders withdrawn ones last. Before
            // this the write path could resolve a different application than the
            // read path had just shown.
            expect(mockPrisma.participantApplication.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { participantId: 'participant-1', deletedAt: null },
                    orderBy: expect.arrayContaining([{ withdrawnAt: { sort: 'asc', nulls: 'first' } }]),
                }),
            );
        });

        it('scopes the query to the given programId when provided', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1', programId: 'prog-42' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());

            await handler.execute(command);

            expect(mockPrisma.participantApplication.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { participantId: 'participant-1', programId: 'prog-42', deletedAt: null },
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
            jest.useFakeTimers().setSystemTime(new Date('2026-08-31T16:59:59.999Z'));

            const result = await handler.execute({ userId: 'user-1' });

            expect(result.success).toBe(true);
        });

        it('ALLOWS submission when the program has no deadline', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({ applicationDeadline: null }),
            );

            const result = await handler.execute({ userId: 'user-1' });

            expect(result.success).toBe(true);
        });
    });

    // ── payment gate delegation ───────────────────────────────────────────────

    describe('payment gate delegation', () => {
        it('calls the shared gate service for every submission', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());

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

    // ── double-submit race (M69) ────────────────────────────────────────────

    describe('double-submit race guard', () => {
        it('writes the submit transition with a status: draft guard in the where clause', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());

            await handler.execute({ userId: 'user-1' });

            expect(mockPrisma.participantApplication.updateMany).toHaveBeenCalledWith({
                where: { id: 'app-1', status: 'draft' },
                data: expect.objectContaining({ status: 'submitted' }),
            });
        });

        it('treats count===0 as an already-done double-submit: returns success without re-running referral side effects', async () => {
            // The status check above read 'draft' (a stale read); the write's
            // guard proves someone else already flipped it to submitted between
            // that read and this write - the concurrent-submit race itself.
            mockPrisma.participantApplication.findFirst.mockResolvedValue(
                makeApp({
                    personalData: { referralCode: 'ABC123' },
                    programId: 'program-123',
                    formFields: [{ name: 'referralCode', label: 'Referral Code', validationRules: {} }],
                }),
            );
            mockPrisma.participantApplication.updateMany.mockResolvedValue({ count: 0 });

            const result = await handler.execute({ userId: 'user-1', programId: 'program-123' });

            // Existing contract for a double-submit: success, not an error.
            expect(result).toEqual({ success: true, applicationId: 'app-1', status: 'submitted' });
            // The loser must not re-run the referral transaction or the funnel
            // advance a second time - the M69 bug was exactly this re-running.
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
            expect(mockReferralFunnel.advanceToApplied).not.toHaveBeenCalled();
        });

        it('still invalidates caches on the count===0 (already-submitted) path', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());
            mockPrisma.participantApplication.updateMany.mockResolvedValue({ count: 0 });

            await handler.execute({ userId: 'user-1' });

            expect(mockCacheService.invalidatePortalCache).toHaveBeenCalledWith('user-1');
        });
    });

    // ── cache invalidation ────────────────────────────────────────────────────

    describe('cache invalidation', () => {
        it('invalidates all relevant cache keys on success', async () => {
            const command: PortalSubmitApplicationCommand = { userId: 'user-1' };
            mockPrisma.participantApplication.findFirst.mockResolvedValue(makeApp());

            await handler.execute(command);

            // Portal reads are keyed per program, so submitting must clear every
            // program variant for this user, not just the bare `:latest` key.
            expect(mockCacheService.invalidatePortalCache).toHaveBeenCalledWith('user-1');
            // The participant's latest-application key is not program-scoped and
            // stays an explicit delete alongside it.
            expect(mockCacheService.invalidateKey).toHaveBeenCalledTimes(1);
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
            mockTx.ambassadorReferral.findFirst.mockResolvedValue(null);
            mockTx.ambassador.findUnique.mockResolvedValue({ id: 'amb-1', referralCode: 'ABC123', isActive: true });
            mockTx.ambassadorReferral.create.mockResolvedValue({});
            mockTx.ambassador.update.mockResolvedValue({});
            mockTx.participant.findUnique.mockResolvedValue({ referralCode: null });
            mockTx.participant.update.mockResolvedValue({});

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
            expect(mockTx.ambassadorReferral.create).toHaveBeenCalledWith({
                data: {
                    ambassadorId: 'amb-1',
                    participantId: 'participant-1',
                    status: 'referred',
                },
            });
            expect(mockTx.ambassador.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ totalReferrals: { increment: 1 } }),
                }),
            );
            // The increment must be rolled back with the rest of the transaction if a
            // later write in the block throws. If it lands outside (on mockPrisma),
            // a failed transaction still leaves totalReferrals permanently bumped with
            // no referral row behind it.
            expectNoOuterWrites({ ambassador: mockPrisma.ambassador });
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
            // Existing referral present
            mockTx.ambassadorReferral.findFirst.mockResolvedValue({ id: 'ref-existing' });

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
            expect(mockTx.ambassadorReferral.create).not.toHaveBeenCalled();
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
            mockTx.ambassadorReferral.findFirst.mockResolvedValue(null);
            // Ambassador not found
            mockTx.ambassador.findUnique.mockResolvedValue(null);

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
            expect(mockTx.ambassadorReferral.create).not.toHaveBeenCalled();
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
            // Make $transaction reject to simulate referral linking failure
            mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

            const result = await handler.execute(command);

            expect(result.success).toBe(true);
        });
    });
});
