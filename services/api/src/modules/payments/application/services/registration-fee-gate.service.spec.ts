import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RegistrationFeeGateService } from './registration-fee-gate.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('RegistrationFeeGateService', () => {
    let service: RegistrationFeeGateService;

    const mockPrisma = {
        participantApplication: {
            findUnique: jest.fn(),
        },
        programPricingTier: {
            findFirst: jest.fn(),
        },
        applicationInvoice: {
            findFirst: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RegistrationFeeGateService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<RegistrationFeeGateService>(RegistrationFeeGateService);
        jest.clearAllMocks();
    });

    const stubApplication = (registrationPaymentStatus: string, programId = 'prog-1') => {
        mockPrisma.participantApplication.findUnique.mockResolvedValue({
            registrationPaymentStatus,
            programId,
        });
    };

    const stubTier = (exists: boolean) => {
        mockPrisma.programPricingTier.findFirst.mockResolvedValue(
            exists ? { id: 'tier-1' } : null,
        );
    };

    const stubPaidInvoice = (exists: boolean) => {
        mockPrisma.applicationInvoice.findFirst.mockResolvedValue(
            exists ? { id: 'invoice-1' } : null,
        );
    };

    // ── no registration tier ──────────────────────────────────────────────────

    describe('when program has NO active registration_fee tier', () => {
        it('ALLOWS regardless of payment status (no fee to pay)', async () => {
            stubApplication('unpaid');
            stubTier(false);

            await expect(service.assertRegistrationFeePaid('app-1')).resolves.toBeUndefined();
            expect(mockPrisma.applicationInvoice.findFirst).not.toHaveBeenCalled();
        });

        it('ALLOWS fully_funded participant when no tier exists', async () => {
            stubApplication('unpaid');
            stubTier(false);

            await expect(service.assertRegistrationFeePaid('app-1')).resolves.toBeUndefined();
        });
    });

    // ── registration tier exists ──────────────────────────────────────────────

    describe('when program HAS an active registration_fee tier', () => {
        beforeEach(() => stubTier(true));

        it('ALLOWS when registrationPaymentStatus is paid (fast path)', async () => {
            stubApplication('paid');

            await expect(service.assertRegistrationFeePaid('app-1')).resolves.toBeUndefined();
            // Fast path exits early — invoice query not needed.
            expect(mockPrisma.applicationInvoice.findFirst).not.toHaveBeenCalled();
        });

        it('ALLOWS when a paid invoice exists (race-condition fallback)', async () => {
            stubApplication('unpaid');
            stubPaidInvoice(true);

            await expect(service.assertRegistrationFeePaid('app-1')).resolves.toBeUndefined();
        });

        it('BLOCKS when payment is unpaid and NO paid invoice exists (regression: the bug)', async () => {
            stubApplication('unpaid');
            stubPaidInvoice(false);

            await expect(service.assertRegistrationFeePaid('app-1')).rejects.toThrow(
                BadRequestException,
            );
            await expect(service.assertRegistrationFeePaid('app-1')).rejects.toThrow(
                'Registration fee must be paid before submission.',
            );
        });

        it('BLOCKS fully_funded participant when fee is unpaid (no category bypass)', async () => {
            // fully_funded is NOT exempt — reimbursement model.
            stubApplication('unpaid');
            stubPaidInvoice(false);

            await expect(service.assertRegistrationFeePaid('app-1')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('ALLOWS fully_funded participant when registrationPaymentStatus is paid', async () => {
            stubApplication('paid');

            await expect(service.assertRegistrationFeePaid('app-1')).resolves.toBeUndefined();
        });

        it('BLOCKS when invoice exists but is not paid (unpaid invoice → still blocked)', async () => {
            // The invoice query filters to paid status only, so null result = blocked.
            stubApplication('unpaid');
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null); // no PAID invoice

            await expect(service.assertRegistrationFeePaid('app-1')).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    // ── application not found ─────────────────────────────────────────────────

    describe('when application is not found', () => {
        it('BLOCKS (fail-closed) when application row is missing', async () => {
            mockPrisma.participantApplication.findUnique.mockResolvedValue(null);

            await expect(service.assertRegistrationFeePaid('app-missing')).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    // ── isRegistrationFeePaid ─────────────────────────────────────────────────

    describe('isRegistrationFeePaid', () => {
        it('returns true when registrationPaymentStatus is paid (fast path)', async () => {
            mockPrisma.participantApplication.findUnique.mockResolvedValue({
                registrationPaymentStatus: 'paid',
                programId: 'prog-1',
            });

            await expect(service.isRegistrationFeePaid('app-1')).resolves.toBe(true);
            // Fast path exits before invoice query.
            expect(mockPrisma.applicationInvoice.findFirst).not.toHaveBeenCalled();
        });

        it('returns true when a paid registration_fee invoice exists (race-condition fallback)', async () => {
            mockPrisma.participantApplication.findUnique.mockResolvedValue({
                registrationPaymentStatus: 'unpaid',
                programId: 'prog-1',
            });
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue({ id: 'invoice-1' });

            await expect(service.isRegistrationFeePaid('app-1')).resolves.toBe(true);
        });

        it('returns false when registrationPaymentStatus is unpaid and no paid invoice exists', async () => {
            mockPrisma.participantApplication.findUnique.mockResolvedValue({
                registrationPaymentStatus: 'unpaid',
                programId: 'prog-1',
            });
            mockPrisma.applicationInvoice.findFirst.mockResolvedValue(null);

            await expect(service.isRegistrationFeePaid('app-1')).resolves.toBe(false);
        });

        it('returns false when application is not found (fail-safe)', async () => {
            mockPrisma.participantApplication.findUnique.mockResolvedValue(null);

            await expect(service.isRegistrationFeePaid('app-missing')).resolves.toBe(false);
        });

        it('returns false (fail-safe) when DB lookup throws', async () => {
            mockPrisma.participantApplication.findUnique.mockRejectedValue(new Error('DB error'));

            await expect(service.isRegistrationFeePaid('app-1')).resolves.toBe(false);
        });
    });
});
