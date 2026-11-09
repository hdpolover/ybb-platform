// services/api/src/modules/portal/application/utils/submission-status.util.ts
import { isPastSubmissionDeadline } from '@shared/utils/submission-deadline.util';

export interface SubmissionChecklist {
    formComplete: boolean;
    registrationFeePaid: boolean;
    submitted: boolean;
}

export interface SubmissionChecklistInput {
    status: string;
    registrationPaymentStatus: string | null | undefined;
    invoices: ReadonlyArray<{ status: unknown; pricingTier?: { feeType?: string | null } | null }>;
    /** Required form items still missing; null when not computed. */
    incompleteItems: readonly string[] | null;
}

/**
 * The paid signal mirrors the submit preview (registrationPaymentStatus is
 * canonical, a paid registration invoice covers the status-propagation race).
 * A non-draft application is submitted, which the submit path only allows with
 * the form complete and the fee paid, so both read true without a lookup.
 */
export function buildSubmissionChecklist(input: SubmissionChecklistInput): SubmissionChecklist {
    const submitted = input.status !== 'draft';
    const hasPaidRegistrationInvoice = input.invoices.some(
        (invoice) =>
            invoice.pricingTier?.feeType === 'registration_fee' &&
            String(invoice.status).toLowerCase() === 'paid',
    );
    return {
        formComplete: submitted || (input.incompleteItems !== null && input.incompleteItems.length === 0),
        registrationFeePaid:
            submitted ||
            String(input.registrationPaymentStatus ?? '').toLowerCase() === 'paid' ||
            hasPaidRegistrationInvoice,
        submitted,
    };
}

/**
 * A draft is closed when it can no longer be submitted:
 *  - the program deadline has passed (the one thing the submit path rejects,
 *    via isPastSubmissionDeadline), or
 *  - its own category's registration windows have all ended and the registration
 *    fee is still unpaid: the mandatory fee can no longer be taken, so the
 *    application cannot be completed. A paid draft can still submit until the
 *    program deadline, so it stays open. Gaps between windows and programs with
 *    no windows configured are not "ended".
 * A program with no deadline never closes on the first rule.
 */
export function isSubmissionClosed(input: {
    status: string;
    programDeadline: Date | null | undefined;
    categoryRegistrationEnded: boolean;
    registrationFeePaid: boolean;
    now: Date;
}): boolean {
    if (input.status !== 'draft') return false;
    return (
        isPastSubmissionDeadline(input.programDeadline, input.now) ||
        (input.categoryRegistrationEnded && !input.registrationFeePaid)
    );
}

/** FF results are embargoed until the program's announcement date has arrived. */
export function resolveVisibleFundingDecision<T extends string>(
    decision: T | null | undefined,
    announcedAt: Date | null | undefined,
    now: Date,
): T | null {
    return decision && announcedAt && announcedAt.getTime() <= now.getTime() ? decision : null;
}
