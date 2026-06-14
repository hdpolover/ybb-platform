import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

/**
 * RegistrationFeeGateService
 *
 * Single authoritative check for whether a participant application has
 * satisfied the program's registration fee requirement before submission.
 *
 * Business rules enforced here:
 * - Gate signal is the PROGRAM's active registration_fee pricing tier, NOT
 *   invoice existence (fail-closed: no invoice → still blocked when a tier exists).
 * - No category bypass: fully_funded and self_funded participants are both
 *   subject to the same gate (reimbursement model — pay first, reimburse later).
 * - A participant passes the gate if EITHER:
 *     (a) application.registrationPaymentStatus === 'paid'  [canonical/fast path], OR
 *     (b) a paid ApplicationInvoice for a registration_fee tier exists [race-condition guard].
 * - When the program has NO active registration_fee tier the gate is a no-op (allow).
 *
 * Used by both the portal submit path and the admin submit path so the two
 * paths cannot diverge.
 */
@Injectable()
export class RegistrationFeeGateService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Asserts that the registration fee requirement is satisfied for the given
     * application. Loads all required state from the database itself so callers
     * do not need to pre-fetch payment status or program pricing tiers.
     *
     * @throws {BadRequestException} when the program requires a registration fee
     *   that has not been paid.
     */
    async assertRegistrationFeePaid(applicationId: string): Promise<void> {
        // Load the minimum fields needed for the gate check.
        const application = await this.prisma.participantApplication.findUnique({
            where: { id: applicationId },
            select: {
                registrationPaymentStatus: true,
                programId: true,
            },
        });

        if (!application) {
            // Caller should have validated existence already; treat as blocked to be safe.
            throw new BadRequestException('Application not found during payment gate check.');
        }

        // 1. Check program config — fail-closed signal.
        //    We look for an active registration_fee tier on the program.
        const tier = await this.prisma.programPricingTier.findFirst({
            where: {
                programId: application.programId,
                isActive: true,
                feeType: 'registration_fee',
            },
            select: { id: true },
        });

        if (!tier) {
            // Program genuinely charges no registration fee → allow.
            return;
        }

        // 2. Fast path: denormalised status already reflects payment.
        if (application.registrationPaymentStatus === 'paid') {
            return;
        }

        // 3. Race-condition fallback: check for a paid registration_fee invoice.
        //    registrationPaymentStatus can lag behind the invoice if the
        //    payment.succeeded event hasn't propagated yet. Allow through if
        //    the invoice itself is already marked paid.
        const paidInvoice = await this.prisma.applicationInvoice.findFirst({
            where: {
                applicationId,
                pricingTier: { feeType: 'registration_fee' },
                status: 'paid',
            },
            select: { id: true },
        });

        if (paidInvoice) {
            return;
        }

        // 4. Program has a registration fee but payment is not confirmed → block.
        //    Covers "never started payment" (no invoice) and "invoice exists but unpaid".
        throw new BadRequestException(
            'Registration fee must be paid before submission.',
        );
    }
}
