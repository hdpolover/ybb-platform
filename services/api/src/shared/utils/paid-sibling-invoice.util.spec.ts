// services/api/src/shared/utils/paid-sibling-invoice.util.spec.ts
import { PaymentStatus, PricingFeeType } from '@prisma/client';
import {
    findPaidSiblingInvoice,
    invoiceCategoryWhere,
    paymentCategoryForFeeType,
} from './paid-sibling-invoice.util';

describe('paymentCategoryForFeeType', () => {
    it('sends only registration_fee to the registration column', () => {
        expect(paymentCategoryForFeeType(PricingFeeType.registration_fee)).toBe('registration');
    });

    // The load-bearing case. program_fee_1 and program_fee_2 are DIFFERENT fee
    // types writing the SAME programPaymentStatus column, which is exactly why a
    // guard keyed on exact feeType equality misses the sibling and lets a cancel
    // overwrite a paid application.
    it.each([
        PricingFeeType.program_fee_1,
        PricingFeeType.program_fee_2,
        PricingFeeType.full_fee,
        PricingFeeType.custom_fee,
    ])('sends %s to the programme column', (feeType) => {
        expect(paymentCategoryForFeeType(feeType)).toBe('program');
    });

    it('treats an unresolved fee type the way every writer ternary does, as programme', () => {
        expect(paymentCategoryForFeeType(undefined)).toBe('program');
        expect(paymentCategoryForFeeType(null)).toBe('program');
    });
});

describe('invoiceCategoryWhere', () => {
    it('matches registration invoices exactly', () => {
        expect(invoiceCategoryWhere('registration')).toEqual({
            pricingTier: { feeType: PricingFeeType.registration_fee },
        });
    });

    it('matches every non-registration fee type for the programme column', () => {
        // Expressed as "not registration" rather than an explicit list, so a new
        // fee type added to the enum is covered on the day it is added.
        expect(invoiceCategoryWhere('program')).toEqual({
            pricingTier: { feeType: { not: PricingFeeType.registration_fee } },
        });
    });
});

describe('findPaidSiblingInvoice', () => {
    const makeClient = (result: { id: string } | null) => {
        const findFirst = jest.fn().mockResolvedValue(result);
        return { client: { applicationInvoice: { findFirst } } as never, findFirst };
    };

    it('finds a paid installment-1 invoice when installment 2 is the one being acted on', async () => {
        const { client, findFirst } = makeClient({ id: 'paid-inv-1' });

        const found = await findPaidSiblingInvoice(
            client,
            'app-1',
            PricingFeeType.program_fee_2,
            'inv-being-cancelled',
        );

        expect(found).toEqual({ id: 'paid-inv-1' });
        expect(findFirst).toHaveBeenCalledWith({
            where: {
                applicationId: 'app-1',
                status: PaymentStatus.paid,
                id: { not: 'inv-being-cancelled' },
                pricingTier: { feeType: { not: PricingFeeType.registration_fee } },
            },
            select: { id: true },
        });
    });

    it('scopes a registration invoice to registration siblings only', async () => {
        const { client, findFirst } = makeClient(null);

        await findPaidSiblingInvoice(client, 'app-1', PricingFeeType.registration_fee, 'inv-2');

        expect(findFirst.mock.calls[0][0].where.pricingTier).toEqual({
            feeType: PricingFeeType.registration_fee,
        });
    });

    it('omits the self-exclusion when no invoice id is supplied', async () => {
        const { client, findFirst } = makeClient(null);

        await findPaidSiblingInvoice(client, 'app-1', PricingFeeType.program_fee_1);

        expect(findFirst.mock.calls[0][0].where.id).toBeUndefined();
    });

    it('returns null when there is no paid sibling', async () => {
        const { client } = makeClient(null);

        await expect(
            findPaidSiblingInvoice(client, 'app-1', PricingFeeType.program_fee_1, 'inv-2'),
        ).resolves.toBeNull();
    });
});
