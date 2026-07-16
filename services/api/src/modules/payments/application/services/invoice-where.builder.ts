// src/modules/payments/application/services/invoice-where.builder.ts
//
// Single source of truth for the `where` clause used to select
// ApplicationInvoice rows for the admin payments list AND the payments Excel
// export. Both callers MUST go through `buildInvoiceWhere` — building the
// where clause independently in two places is exactly how list/export
// filters drifted before (list showed 15 filtered rows, export shipped 1881).
import { HttpException } from '@nestjs/common';
import { Prisma, PaymentStatus } from '@prisma/client';

// Who paid: 'ambassador' = the payer holds an ambassador record, 'participant' = they don't.
export const PAYER_TYPES = ['all', 'participant', 'ambassador'] as const;
export type PayerType = (typeof PAYER_TYPES)[number];

export const INVOICE_ID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Display/filter-only threshold for surfacing invoices stuck in 'processing'
// past a reasonable window. Not tied to the reconciliation cron's own grace
// period (PAYMENT_RECONCILIATION_GRACE_MINUTES in payment-reconciliation.service.ts),
// which governs when the cron itself acts — this only affects what "follow up"
// filtering (list) and export selection consider stuck.
export const STUCK_PROCESSING_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const PARTICIPANT_CANCELLATION_REASON = 'Cancelled by participant';

export interface InvoiceFilterQuery {
    // Optional so callers that historically had no programId requirement
    // (e.g. the reporting export before this filter set existed) keep behaving
    // the same way: an absent programId means "no program restriction",
    // since Prisma silently drops `undefined` fields from a where clause.
    // The admin list endpoint enforces its own `programId is required` 400
    // before ever calling this builder, so it always passes a real value.
    programId?: string;
    status?: string;
    search?: string;
    paymentMethod?: string;
    tierId?: string;
    feeType?: string;
    applicationStatus?: string;
    followUpStatus?: string;
    payerType?: string;
    currency?: string;
    dateFrom?: string;
    dateTo?: string;
    paidFrom?: string;
    paidTo?: string;
    minAmount?: string | number;
    maxAmount?: string | number;
}

/** Validates & normalizes a raw `payerType` query param. Throws 400 on an unknown value. */
export function resolvePayerTypeFilter(payerType?: string): PayerType {
    const payerTypeFilter = payerType?.trim() || 'all';
    if (!PAYER_TYPES.includes(payerTypeFilter as PayerType)) {
        throw new HttpException(`payerType must be one of: ${PAYER_TYPES.join(', ')}`, 400);
    }
    return payerTypeFilter as PayerType;
}

export function endOfDayUtc(dateString: string): Date {
    const base = new Date(dateString);
    if (Number.isNaN(base.getTime())) {
        return new Date(dateString);
    }
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 23, 59, 59, 999));
}

export function buildFollowUpStatusWhere(
    followUpStatus?: string,
): Prisma.ApplicationInvoiceWhereInput | null {
    switch ((followUpStatus ?? '').trim()) {
        case 'participant_cancelled':
            return {
                status: PaymentStatus.cancelled,
                rejectionReason: {
                    equals: PARTICIPANT_CANCELLATION_REASON,
                    mode: 'insensitive',
                },
            };
        case 'payment_cancelled_issue':
            return {
                status: PaymentStatus.cancelled,
                NOT: {
                    rejectionReason: {
                        equals: PARTICIPANT_CANCELLATION_REASON,
                        mode: 'insensitive',
                    },
                },
            };
        case 'payment_failed':
            return {
                status: PaymentStatus.failed,
                verifiedBy: null,
            };
        case 'manual_proof_rejected':
            return {
                status: PaymentStatus.failed,
                verifiedBy: { not: null },
            };
        case 'payment_processing_stuck': {
            const staleCutoff = new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MS);
            return {
                status: PaymentStatus.processing,
                updatedAt: { lt: staleCutoff },
            };
        }
        case 'all_problems': {
            const staleCutoff = new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MS);
            return {
                OR: [
                    { status: PaymentStatus.failed, verifiedBy: null },
                    { status: PaymentStatus.failed, verifiedBy: { not: null } },
                    {
                        status: PaymentStatus.cancelled,
                        NOT: {
                            rejectionReason: {
                                equals: PARTICIPANT_CANCELLATION_REASON,
                                mode: 'insensitive',
                            },
                        },
                    },
                    { status: PaymentStatus.processing, updatedAt: { lt: staleCutoff } },
                ],
            };
        }
        default:
            return null;
    }
}

/**
 * Excludes obsolete registration_fee invoices: invoices whose pricing tier's
 * allowed_categories does NOT include the application's current
 * applicationCategory. These arise when a participant switches funding
 * category (self_funded <-> fully_funded). Callers compute `obsoleteInvoiceIds`
 * via the raw SQL query in `findObsoleteRegistrationFeeInvoiceIds` (or their
 * own equivalent) and pass it in here.
 */
export function buildExcludeObsoleteWhere(
    obsoleteInvoiceIds: string[],
): Prisma.ApplicationInvoiceWhereInput {
    return obsoleteInvoiceIds.length > 0 ? { id: { notIn: obsoleteInvoiceIds } } : {};
}

/**
 * The raw SQL used to find obsolete registration_fee invoice IDs for a program.
 * Exposed as a `Prisma.sql` fragment (rather than a method that runs the
 * query) so callers can run it against whichever Prisma client instance
 * (read replica vs primary) fits their context, exactly like listInvoices
 * does via `this.readPrisma.$queryRaw`.
 */
export function obsoleteRegistrationFeeInvoiceIdsSql(programId: string) {
    return Prisma.sql`
        SELECT ai.id::text AS id
        FROM application_invoices ai
        JOIN program_pricing_tiers pt ON pt.id = ai.pricing_tier_id
        JOIN participant_applications pa ON pa.id = ai.application_id
        WHERE pa.program_id = ${programId}::uuid
          AND pa.deleted_at IS NULL
          AND pt.fee_type = 'registration_fee'
          AND pa.application_category IS NOT NULL
          AND NOT (pa.application_category = ANY(pt.allowed_categories))
    `;
}

/**
 * Builds the `where` clause for selecting ApplicationInvoice rows given the
 * admin payments filter set. This MUST be the only place this logic lives —
 * both the list endpoint (`PaymentAdminController.listInvoices`) and the
 * export endpoint (`ReportingService.exportPayments`) call this so they can
 * never drift apart again.
 */
export function buildInvoiceWhere(
    query: InvoiceFilterQuery,
    obsoleteInvoiceIds: string[] = [],
): Prisma.ApplicationInvoiceWhereInput {
    const {
        programId,
        status,
        search,
        paymentMethod,
        tierId,
        feeType,
        applicationStatus,
        followUpStatus,
        payerType,
        currency,
        dateFrom,
        dateTo,
        paidFrom,
        paidTo,
        minAmount,
        maxAmount,
    } = query;

    const payerTypeFilter = resolvePayerTypeFilter(payerType);

    const minAmountNum =
        typeof minAmount === 'number'
            ? minAmount
            : typeof minAmount === 'string' && minAmount.trim() !== ''
                ? Number(minAmount)
                : undefined;
    const maxAmountNum =
        typeof maxAmount === 'number'
            ? maxAmount
            : typeof maxAmount === 'string' && maxAmount.trim() !== ''
                ? Number(maxAmount)
                : undefined;

    const applicationFilter: Prisma.ParticipantApplicationWhereInput = { programId };
    const searchKeyword = search?.trim() || null;
    if (applicationStatus?.trim()) {
        applicationFilter.status = applicationStatus as Prisma.EnumApplicationStatusFilter;
    }
    // Classify a payer by whether they hold an ambassador record at all. This is a
    // historical question ("was this paid by an ambassador"), not an authorization one,
    // so it deliberately ignores isActive/deletedAt — deactivating or deleting an
    // ambassador must not retroactively reclassify their past payments and shift the stats.
    if (payerTypeFilter === 'ambassador') {
        applicationFilter.participant = { user: { ambassador: { isNot: null } } };
    } else if (payerTypeFilter === 'participant') {
        applicationFilter.participant = { user: { ambassador: { is: null } } };
    }

    const where: Prisma.ApplicationInvoiceWhereInput = { application: applicationFilter };
    const followUpWhere = buildFollowUpStatusWhere(followUpStatus);
    if (followUpWhere) {
        const andFilters = Array.isArray(where.AND)
            ? where.AND
            : where.AND
                ? [where.AND]
                : [];
        where.AND = [...andFilters, followUpWhere];
    }
    if (searchKeyword) {
        const participantSearch: Prisma.ParticipantWhereInput = {
            OR: [
                { fullName: { contains: searchKeyword, mode: 'insensitive' } },
                { user: { email: { contains: searchKeyword, mode: 'insensitive' } } },
                { nationality: { contains: searchKeyword, mode: 'insensitive' } },
                { originCountry: { contains: searchKeyword, mode: 'insensitive' } },
            ],
        };
        const invoiceSearch: Prisma.ApplicationInvoiceWhereInput[] = [
            { externalTransactionId: { contains: searchKeyword, mode: 'insensitive' } },
            { externalIntentId: { contains: searchKeyword, mode: 'insensitive' } },
            {
                application: {
                    ...applicationFilter,
                    participant: participantSearch,
                },
            },
        ];
        if (INVOICE_ID_RE.test(searchKeyword)) {
            invoiceSearch.unshift({ id: searchKeyword });
        }
        where.OR = invoiceSearch;
    }
    if (status) where.status = status as PaymentStatus;
    if (paymentMethod?.trim()) where.paymentMethod = paymentMethod.trim();
    if (tierId?.trim()) where.pricingTierId = tierId.trim();
    if (feeType?.trim()) {
        where.pricingTier = { feeType: feeType.trim() as Prisma.EnumPricingFeeTypeFilter };
    }
    if (currency?.trim()) where.currency = currency.trim();

    if (dateFrom || dateTo) {
        where.createdAt = {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: endOfDayUtc(dateTo) } : {}),
        };
    }
    if (paidFrom || paidTo) {
        where.paidAt = {
            ...(paidFrom ? { gte: new Date(paidFrom) } : {}),
            ...(paidTo ? { lte: endOfDayUtc(paidTo) } : {}),
        };
    }
    if (minAmountNum !== undefined || maxAmountNum !== undefined) {
        where.amount = {
            ...(minAmountNum !== undefined && !Number.isNaN(minAmountNum) ? { gte: new Prisma.Decimal(minAmountNum) } : {}),
            ...(maxAmountNum !== undefined && !Number.isNaN(maxAmountNum) ? { lte: new Prisma.Decimal(maxAmountNum) } : {}),
        };
    }

    // Exclude obsolete registration_fee invoices. The id field is only used
    // inside where.OR (UUID search), never as a top-level scalar on `where`,
    // so adding id: { notIn } at the top level is safe and ANDs correctly.
    if (obsoleteInvoiceIds.length > 0) {
        Object.assign(where, buildExcludeObsoleteWhere(obsoleteInvoiceIds));
    }

    return where;
}
