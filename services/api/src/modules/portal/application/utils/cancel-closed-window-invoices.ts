// src/modules/portal/application/utils/cancel-closed-window-invoices.ts

/**
 * Auto-cancels unpaid `registration_fee` invoices whose category window has
 * closed (registration-fee-window.ts, PR #217 onward). Once a category's
 * window closes, that invoice can never again be paid or confirmed - it's a
 * dead obligation sitting on the participant's Payments page. This clears it
 * so support can tell "the window closed on us" apart from a user-initiated
 * cancellation (rejectionReason), and so the participant isn't left staring
 * at an invoice they cannot act on.
 *
 * Called lazily from the portal read paths (payments, dashboard) rather than
 * eagerly on window close, matching how the window check itself only runs
 * when a participant touches a payment. Idempotent (only matches `unpaid`
 * rows) and re-checks `unpaid` inside the update in case a payment settles
 * between the read and the write. Deliberately never throws: it runs inside
 * a read path, and a page must still render if this fails.
 */
import { Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { resolveRegistrationFeePhase } from './registration-fee-window';

const logger = new Logger('CancelClosedWindowInvoices');

export const CLOSED_WINDOW_CANCELLATION_REASON =
    'Auto-cancelled: registration window for this category closed before payment.';

export async function cancelClosedWindowRegistrationInvoices(
    prisma: PrismaService,
    applicationId: string,
    category: string | null | undefined,
    now: Date = new Date(),
): Promise<void> {
    try {
        const application = await prisma.participantApplication.findUnique({
            where: { id: applicationId },
            select: {
                invoices: {
                    where: { status: PaymentStatus.unpaid, pricingTier: { feeType: 'registration_fee' } },
                    select: {
                        id: true,
                        pricingTier: {
                            select: {
                                feeType: true,
                                isActive: true,
                                deletedAt: true,
                                allowedCategories: true,
                                validityPeriods: { select: { startDate: true, endDate: true } },
                            },
                        },
                    },
                },
                program: {
                    select: {
                        pricingTiers: {
                            where: { feeType: 'registration_fee', isActive: true, deletedAt: null },
                            select: {
                                feeType: true,
                                allowedCategories: true,
                                validityPeriods: { select: { startDate: true, endDate: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!application || application.invoices.length === 0) return;

        const registrationTiers = application.program.pricingTiers;
        const closedInvoiceIds = application.invoices
            .filter(
                (invoice) =>
                    invoice.pricingTier &&
                    resolveRegistrationFeePhase({
                        category,
                        tier: invoice.pricingTier,
                        registrationTiers,
                        now,
                    }) === 'closed',
            )
            .map((invoice) => invoice.id);
        if (closedInvoiceIds.length === 0) return;

        await prisma.applicationInvoice.updateMany({
            // Re-check `unpaid` here, not just in the read above: a payment
            // landing between the read and this write must not be clobbered.
            where: { id: { in: closedInvoiceIds }, status: PaymentStatus.unpaid },
            data: {
                status: PaymentStatus.cancelled,
                rejectionReason: CLOSED_WINDOW_CANCELLATION_REASON,
            },
        });
    } catch (error) {
        logger.warn(
            `Failed to auto-cancel closed-window registration invoices for application ${applicationId}: ${error instanceof Error ? error.message : error}`,
        );
    }
}
