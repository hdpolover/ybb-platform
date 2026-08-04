import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubmitApplicationHandler } from './submit-application.handler';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { SubmitApplicationCommand } from '../submit-application.command';
import { ApplicationStatus, ApplicationCategory } from '@core/entities/participant-application.entity';

/** Minimal domain entity stub sufficient for the handler under test. */
const makeDomainApp = (overrides: {
    id?: string;
    participantId?: string;
    programId?: string;
    status?: ApplicationStatus;
    applicationCategory?: ApplicationCategory;
} = {}) => ({
    id: overrides.id ?? 'app-1',
    participantId: overrides.participantId ?? 'participant-1',
    programId: overrides.programId ?? 'program-1',
    status: overrides.status ?? ApplicationStatus.DRAFT,
    applicationCategory: overrides.applicationCategory ?? ApplicationCategory.SELF_FUNDED,
    registrationPaymentStatus: 'unpaid',
    canSubmit: jest.fn().mockReturnValue(
        (overrides.status ?? ApplicationStatus.DRAFT) === ApplicationStatus.DRAFT,
    ),
    submit: jest.fn(),
    addStatusToHistory: jest.fn(),
});

describe('SubmitApplicationHandler (admin path)', () => {
    let handler: SubmitApplicationHandler;

    const mockAppRepository = {
        findById: jest.fn(),
        update: jest.fn(),
    };

    const mockMapper = {
        toDto: jest.fn().mockReturnValue({ id: 'app-1' }),
    };

    const mockMetrics = {
        applicationSubmittedTotal: { inc: jest.fn() },
    };

    const mockCacheService = {
        invalidateKey: jest.fn().mockResolvedValue(undefined),
    };

    const mockReferralFunnel = {
        advanceToApplied: jest.fn().mockResolvedValue(undefined),
    };

    const mockGateService = {
        assertRegistrationFeePaid: jest.fn(),
    };

    const mockPrisma = {
        program: {
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SubmitApplicationHandler,
                { provide: APPLICATION_REPOSITORY, useValue: mockAppRepository },
                { provide: ApplicationMapper, useValue: mockMapper },
                { provide: MetricsService, useValue: mockMetrics },
                { provide: CacheService, useValue: mockCacheService },
                { provide: ReferralFunnelService, useValue: mockReferralFunnel },
                { provide: RegistrationFeeGateService, useValue: mockGateService },
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        handler = module.get<SubmitApplicationHandler>(SubmitApplicationHandler);
        jest.clearAllMocks();
        // Default: gate allows
        mockGateService.assertRegistrationFeePaid.mockResolvedValue(undefined);
        // Default: program has no deadline (unrestricted)
        mockPrisma.program.findUnique.mockResolvedValue({
            name: 'Test Program',
            applicationDeadline: null,
        });
    });

    // ── guard rails ───────────────────────────────────────────────────────────

    describe('guard rails', () => {
        it('throws NotFoundException when application is not found', async () => {
            mockAppRepository.findById.mockResolvedValue(null);

            await expect(
                handler.execute(new SubmitApplicationCommand('app-1', 'participant-1')),
            ).rejects.toThrow(NotFoundException);
        });

        it('throws BadRequestException when participant does not own the application', async () => {
            mockAppRepository.findById.mockResolvedValue(
                makeDomainApp({ participantId: 'other-participant' }),
            );

            await expect(
                handler.execute(new SubmitApplicationCommand('app-1', 'participant-1')),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException when application is not in draft status', async () => {
            const app = makeDomainApp({ status: ApplicationStatus.SUBMITTED });
            app.canSubmit.mockReturnValue(false);
            mockAppRepository.findById.mockResolvedValue(app);

            await expect(
                handler.execute(new SubmitApplicationCommand('app-1', 'participant-1')),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ── submission deadline gate ────────────────────────────────────────────────

    describe('submission deadline gate', () => {
        it('BLOCKS submission with a specific message naming the program and deadline when past deadline', async () => {
            mockAppRepository.findById.mockResolvedValue(makeDomainApp({ programId: 'program-1' }));
            mockPrisma.program.findUnique.mockResolvedValue({
                name: 'Istanbul Youth Summit 2027',
                applicationDeadline: new Date('2026-08-30T17:00:00.000Z'), // WIB midnight, 31 Aug
            });

            const command = new SubmitApplicationCommand('app-1', 'participant-1');
            // now = 00:00:00 WIB the day after the deadline (past cutoff)
            jest.useFakeTimers().setSystemTime(new Date('2026-08-31T17:00:00.000Z'));

            try {
                await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
                await expect(handler.execute(command)).rejects.toThrow('Istanbul Youth Summit 2027');
            } finally {
                jest.useRealTimers();
            }

            // Gate must never be reached once the deadline check fails.
            expect(mockGateService.assertRegistrationFeePaid).not.toHaveBeenCalled();
        });

        it('ALLOWS submission at 23:59:59.999 WIB on the deadline day itself', async () => {
            const app = makeDomainApp({ programId: 'program-1' });
            mockAppRepository.findById.mockResolvedValue(app);
            mockAppRepository.update.mockResolvedValue(app);
            mockPrisma.program.findUnique.mockResolvedValue({
                name: 'Istanbul Youth Summit 2027',
                applicationDeadline: new Date('2026-08-30T17:00:00.000Z'), // WIB midnight, 31 Aug
            });

            jest.useFakeTimers().setSystemTime(new Date('2026-08-31T16:59:59.999Z'));
            try {
                await expect(
                    handler.execute(new SubmitApplicationCommand('app-1', 'participant-1')),
                ).resolves.toBeDefined();
            } finally {
                jest.useRealTimers();
            }
        });

        it('ALLOWS submission when the program has no deadline set', async () => {
            const app = makeDomainApp({ programId: 'program-1' });
            mockAppRepository.findById.mockResolvedValue(app);
            mockAppRepository.update.mockResolvedValue(app);
            mockPrisma.program.findUnique.mockResolvedValue({
                name: 'Open Program',
                applicationDeadline: null,
            });

            await expect(
                handler.execute(new SubmitApplicationCommand('app-1', 'participant-1')),
            ).resolves.toBeDefined();
        });
    });

    // ── payment gate (shared service) ─────────────────────────────────────────

    describe('payment gate via shared RegistrationFeeGateService', () => {
        it('BLOCKS fully_funded participant when gate service throws', async () => {
            // No fully_funded bypass — the gate decides.
            mockGateService.assertRegistrationFeePaid.mockRejectedValue(
                new BadRequestException('Registration fee must be paid before submission.'),
            );
            mockAppRepository.findById.mockResolvedValue(
                makeDomainApp({ applicationCategory: ApplicationCategory.FULLY_FUNDED }),
            );

            await expect(
                handler.execute(new SubmitApplicationCommand('app-1', 'participant-1')),
            ).rejects.toThrow('Registration fee must be paid before submission.');
        });

        it('BLOCKS self_funded participant when gate service throws', async () => {
            mockGateService.assertRegistrationFeePaid.mockRejectedValue(
                new BadRequestException('Registration fee must be paid before submission.'),
            );
            mockAppRepository.findById.mockResolvedValue(
                makeDomainApp({ applicationCategory: ApplicationCategory.SELF_FUNDED }),
            );

            await expect(
                handler.execute(new SubmitApplicationCommand('app-1', 'participant-1')),
            ).rejects.toThrow('Registration fee must be paid before submission.');
        });

        it('ALLOWS fully_funded participant when gate service resolves (fee paid)', async () => {
            mockGateService.assertRegistrationFeePaid.mockResolvedValue(undefined);
            const app = makeDomainApp({ applicationCategory: ApplicationCategory.FULLY_FUNDED });
            mockAppRepository.findById.mockResolvedValue(app);
            mockAppRepository.update.mockResolvedValue(app);

            const result = await handler.execute(
                new SubmitApplicationCommand('app-1', 'participant-1'),
            );

            expect(result).toBeDefined();
            expect(mockGateService.assertRegistrationFeePaid).toHaveBeenCalledWith('app-1');
        });

        it('ALLOWS any participant when gate service resolves (no fee / fee paid)', async () => {
            mockGateService.assertRegistrationFeePaid.mockResolvedValue(undefined);
            const app = makeDomainApp();
            mockAppRepository.findById.mockResolvedValue(app);
            mockAppRepository.update.mockResolvedValue(app);

            const result = await handler.execute(
                new SubmitApplicationCommand('app-1', 'participant-1'),
            );

            expect(result).toBeDefined();
        });

        it('calls gate service with the correct applicationId', async () => {
            const app = makeDomainApp({ id: 'app-specific-id' });
            mockAppRepository.findById.mockResolvedValue(app);
            mockAppRepository.update.mockResolvedValue(app);

            await handler.execute(
                new SubmitApplicationCommand('app-specific-id', 'participant-1'),
            );

            expect(mockGateService.assertRegistrationFeePaid).toHaveBeenCalledWith('app-specific-id');
        });
    });

    // ── success path ──────────────────────────────────────────────────────────

    describe('success path', () => {
        it('calls submit, update, metrics, cache invalidation, and referral funnel on success', async () => {
            const app = makeDomainApp();
            mockAppRepository.findById.mockResolvedValue(app);
            mockAppRepository.update.mockResolvedValue(app);

            await handler.execute(new SubmitApplicationCommand('app-1', 'participant-1'));

            expect(app.submit).toHaveBeenCalled();
            expect(app.addStatusToHistory).toHaveBeenCalled();
            expect(mockAppRepository.update).toHaveBeenCalledWith(app);
            expect(mockMetrics.applicationSubmittedTotal.inc).toHaveBeenCalled();
            expect(mockCacheService.invalidateKey).toHaveBeenCalled();
            expect(mockReferralFunnel.advanceToApplied).toHaveBeenCalledWith(
                'participant-1',
                'program-1',
            );
        });
    });
});
