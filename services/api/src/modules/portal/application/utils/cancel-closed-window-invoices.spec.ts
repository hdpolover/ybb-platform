// src/modules/portal/application/utils/cancel-closed-window-invoices.spec.ts
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
    CLOSED_WINDOW_CANCELLATION_REASON,
    cancelClosedWindowRegistrationInvoices,
} from './cancel-closed-window-invoices';

describe('cancelClosedWindowRegistrationInvoices', () => {
    const now = new Date('2026-09-17T05:00:00Z');
    const closedPeriod = [{ startDate: new Date('2026-07-01T00:00:00Z'), endDate: new Date('2026-09-05T00:00:00Z') }];
    const openPeriod = [{ startDate: new Date('2026-07-01T00:00:00Z'), endDate: new Date('2026-11-30T00:00:00Z') }];

    const ffTier = (validityPeriods = closedPeriod) => ({
        feeType: 'registration_fee',
        isActive: true,
        deletedAt: null,
        allowedCategories: ['fully_funded'],
        validityPeriods,
    });

    function buildPrisma(invoices: unknown[], registrationTiers: unknown[]) {
        const findUnique = jest.fn().mockResolvedValue({
            invoices,
            program: { pricingTiers: registrationTiers },
        });
        const updateMany = jest.fn().mockResolvedValue({ count: invoices.length });
        return {
            prisma: { participantApplication: { findUnique }, applicationInvoice: { updateMany } } as unknown as PrismaService,
            findUnique,
            updateMany,
        };
    }

    it('cancels a closed-window unpaid invoice and records a distinguishable reason', async () => {
        const invoice = { id: 'inv-1', pricingTier: ffTier() };
        const { prisma, updateMany } = buildPrisma([invoice], [ffTier()]);

        await cancelClosedWindowRegistrationInvoices(prisma, 'app-1', 'fully_funded', now);

        expect(updateMany).toHaveBeenCalledWith({
            where: { id: { in: ['inv-1'] }, status: PaymentStatus.unpaid },
            data: { status: PaymentStatus.cancelled, rejectionReason: CLOSED_WINDOW_CANCELLATION_REASON },
        });
    });

    it('does not touch an invoice whose window is still open', async () => {
        const invoice = { id: 'inv-1', pricingTier: ffTier(openPeriod) };
        const { prisma, updateMany } = buildPrisma([invoice], [ffTier(openPeriod)]);

        await cancelClosedWindowRegistrationInvoices(prisma, 'app-1', 'fully_funded', now);

        expect(updateMany).not.toHaveBeenCalled();
    });

    it('leaves a tier with no validity periods alone (not treated as closed)', async () => {
        const noPeriodsTier = { ...ffTier(), validityPeriods: [] };
        const invoice = { id: 'inv-1', pricingTier: noPeriodsTier };
        const { prisma, updateMany } = buildPrisma([invoice], [noPeriodsTier]);

        await cancelClosedWindowRegistrationInvoices(prisma, 'app-1', 'fully_funded', now);

        expect(updateMany).not.toHaveBeenCalled();
    });

    it('only the read query is scoped to unpaid; paid/processing invoices never reach the fetch, let alone the update', async () => {
        // The read in the helper already filters `status: unpaid` at the DB
        // level, so a paid/processing invoice never appears in `invoices` here.
        const { prisma, updateMany, findUnique } = buildPrisma([], [ffTier()]);

        await cancelClosedWindowRegistrationInvoices(prisma, 'app-1', 'fully_funded', now);

        expect(findUnique.mock.calls[0][0].select.invoices.where.status).toBe(PaymentStatus.unpaid);
        expect(updateMany).not.toHaveBeenCalled();
    });

    it('never throws when the query fails — the caller is a read path that must still render', async () => {
        const findUnique = jest.fn().mockRejectedValue(new Error('db down'));
        const prisma = { participantApplication: { findUnique }, applicationInvoice: { updateMany: jest.fn() } } as unknown as PrismaService;

        await expect(cancelClosedWindowRegistrationInvoices(prisma, 'app-1', 'fully_funded', now)).resolves.toBeUndefined();
    });
});
