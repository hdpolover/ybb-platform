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
 * A draft can no longer be submitted once its own category has no open window
 * (categoryWindowEnd is the end of the window active now, null when none) AND
 * the program deadline, which the submit path enforces (isPastSubmissionDeadline),
 * has passed. A gap between windows with the program deadline still ahead is not
 * closed: the dashboard falls back to the program deadline in that case.
 * A program with no deadline is never closed.
 */
export function isSubmissionClosed(
    status: string,
    categoryWindowEnd: Date | null,
    programDeadline: Date | null | undefined,
    now: Date,
): boolean {
    return status === 'draft' && categoryWindowEnd === null && isPastSubmissionDeadline(programDeadline, now);
}
