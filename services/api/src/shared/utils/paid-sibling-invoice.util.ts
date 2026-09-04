// services/api/src/shared/utils/paid-sibling-invoice.util.ts

import { PaymentStatus, PricingFeeType, Prisma } from '@prisma/client';

/**
 * "Is another invoice for this same application-level payment status already paid?"
 *
 * A ParticipantApplication carries exactly TWO payment-status columns,
 * `registrationPaymentStatus` and `programPaymentStatus`, but a programme can
 * configure FIVE fee types against them. Every writer in the codebase collapses
 * fee type to column with the same ternary — `feeType === 'registration_fee'`
 * chooses registration, everything else (and a missing tier) chooses programme.
 *
 * That collapse is why this guard groups by COLUMN and not by exact fee type,
 * which is the mistake to avoid here: `program_fee_1` and `program_fee_2` are
 * different fee types writing the SAME column, so a guard keyed on exact
 * `feeType` equality does not see installment 1's paid invoice when installment
 * 2 is cancelled, and the cancel still overwrites a paid application. The one
 * pre-existing implementation of this guard (payment-reconciliation.service.ts
 * `settlePaid`) is keyed on `registration_fee` exactly and therefore covers only
 * the registration column; the programme column had no guard anywhere, and
 * production carries the damage to prove it.
 *
 * Deliberately a READ, not a transaction wrapper. The call sites build their
 * writes three different ways — `prisma.$transaction([...])` array batches,
 * `unitOfWork.execute(async (repos) => ...)` callbacks, and plain awaits — and
 * an array batch cannot host a read-then-decide helper, because every member
 * has to be a built promise before the array is passed. Running the guard first
 * and letting each caller shape its own patch fits all three unchanged. It
 * accepts the same read-then-write race `settlePaid` has always accepted;
 * closing that needs a DB constraint, not a helper.
 */

export type ApplicationPaymentCategory = 'registration' | 'program';

/**
 * The application column a given fee type writes to.
 *
 * Callers pass `invoice.pricingTier?.feeType`. `pricingTierId` is a REQUIRED FK
 * (applications.prisma, and production has zero nulls), so an undefined here
 * never means "no tier" - it means the caller did not `include` the relation.
 * Such a caller would silently categorise a registration invoice as programme,
 * so make sure the tier is selected before calling this.
 */
export function paymentCategoryForFeeType(
    feeType: PricingFeeType | string | null | undefined,
): ApplicationPaymentCategory {
    return feeType === PricingFeeType.registration_fee ? 'registration' : 'program';
}

/** Matches every invoice whose fee type writes `category`'s column. */
export function invoiceCategoryWhere(
    category: ApplicationPaymentCategory,
): Prisma.ApplicationInvoiceWhereInput {
    if (category === 'registration') {
        return { pricingTier: { feeType: PricingFeeType.registration_fee } };
    }
    return { pricingTier: { feeType: { not: PricingFeeType.registration_fee } } };
}

type InvoiceReader = Pick<Prisma.TransactionClient, 'applicationInvoice'>;

/**
 * Returns another already-paid invoice writing the same application column, or
 * null. Pass `excludeInvoiceId` as the invoice being acted on, so an invoice
 * never supersedes itself.
 */
export async function findPaidSiblingInvoice(
    client: InvoiceReader,
    applicationId: string,
    feeType: PricingFeeType | string | null | undefined,
    excludeInvoiceId?: string,
): Promise<{ id: string } | null> {
    return client.applicationInvoice.findFirst({
        where: {
            applicationId,
            status: PaymentStatus.paid,
            ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
            ...invoiceCategoryWhere(paymentCategoryForFeeType(feeType)),
        },
        select: { id: true },
    });
}

/** The message stamped on an invoice superseded by an already-paid sibling. */
export function supersededByPaidInvoiceReason(paidInvoiceId: string): string {
    return `Duplicate payment: gateway succeeded but superseded by paid invoice ${paidInvoiceId}. Needs refund review.`;
}
