// services/api/src/modules/portal/application/utils/submission-status.util.spec.ts
import { buildSubmissionChecklist, isSubmissionClosed, resolveVisibleFundingDecision } from './submission-status.util';

describe('buildSubmissionChecklist', () => {
    const base = { status: 'draft', registrationPaymentStatus: 'unpaid', invoices: [], incompleteItems: [] as string[] | null };

    it('marks a draft with nothing missing and no payment as form-complete but unpaid', () => {
        expect(buildSubmissionChecklist(base)).toEqual({ formComplete: true, registrationFeePaid: false, submitted: false });
    });

    it('marks the form incomplete when required items are missing', () => {
        expect(buildSubmissionChecklist({ ...base, incompleteItems: ['Complete Personal Details'] }).formComplete).toBe(false);
    });

    it('treats an unknown completeness result as incomplete', () => {
        expect(buildSubmissionChecklist({ ...base, incompleteItems: null }).formComplete).toBe(false);
    });

    it('reads paid from registrationPaymentStatus', () => {
        expect(buildSubmissionChecklist({ ...base, registrationPaymentStatus: 'paid' }).registrationFeePaid).toBe(true);
    });

    it('reads paid from a paid registration invoice when the status has not propagated', () => {
        const invoices = [{ status: 'paid', pricingTier: { feeType: 'registration_fee' } }];
        expect(buildSubmissionChecklist({ ...base, invoices }).registrationFeePaid).toBe(true);
    });

    it('ignores a paid non-registration invoice', () => {
        const invoices = [{ status: 'paid', pricingTier: { feeType: 'program_fee' } }];
        expect(buildSubmissionChecklist({ ...base, invoices }).registrationFeePaid).toBe(false);
    });

    it('reports everything true for a submitted application', () => {
        expect(buildSubmissionChecklist({ ...base, status: 'submitted', incompleteItems: null })).toEqual({
            formComplete: true,
            registrationFeePaid: true,
            submitted: true,
        });
    });
});

describe('isSubmissionClosed', () => {
    const now = new Date('2026-11-09T05:00:00Z');
    const past = new Date('2026-10-01T00:00:00Z');
    const future = new Date('2026-12-01T00:00:00Z');
    const open = { status: 'draft', programDeadline: future, categoryRegistrationEnded: false, registrationFeePaid: false, now };

    it('is open for a draft with the deadline ahead and its category window not ended', () => {
        expect(isSubmissionClosed(open)).toBe(false);
    });

    it('is closed once the program deadline has passed, even if the fee is paid', () => {
        expect(isSubmissionClosed({ ...open, programDeadline: past, registrationFeePaid: true })).toBe(true);
    });

    it('is closed when the category windows ended and the fee is unpaid', () => {
        expect(isSubmissionClosed({ ...open, categoryRegistrationEnded: true })).toBe(true);
    });

    it('stays open when the category windows ended but the fee is already paid (submit still allowed)', () => {
        expect(isSubmissionClosed({ ...open, categoryRegistrationEnded: true, registrationFeePaid: true })).toBe(false);
    });

    it('stays open through the deadline day itself (WIB calendar day rule)', () => {
        // Stored as 2026-11-09T00:00Z = 07:00 WIB; cutoff is the end of that WIB day.
        expect(isSubmissionClosed({ ...open, programDeadline: new Date('2026-11-09T00:00:00Z') })).toBe(false);
    });

    it('is open when the program has no deadline', () => {
        expect(isSubmissionClosed({ ...open, programDeadline: null })).toBe(false);
    });

    it('is never closed once submitted', () => {
        expect(isSubmissionClosed({ ...open, status: 'submitted', programDeadline: past, categoryRegistrationEnded: true })).toBe(false);
    });
});

describe('resolveVisibleFundingDecision', () => {
    const now = new Date('2026-11-09T05:00:00Z');

    it('hides the decision when no announcement date is set', () => {
        expect(resolveVisibleFundingDecision('awarded', null, now)).toBeNull();
    });

    it('hides the decision while the announcement date is in the future', () => {
        expect(resolveVisibleFundingDecision('not_awarded', new Date('2026-11-20T00:00:00Z'), now)).toBeNull();
    });

    it('shows the decision once the announcement date has passed', () => {
        expect(resolveVisibleFundingDecision('awarded', new Date('2026-11-01T00:00:00Z'), now)).toBe('awarded');
    });

    it('shows the decision at exactly the announcement instant', () => {
        expect(resolveVisibleFundingDecision('awarded', now, now)).toBe('awarded');
    });

    it('stays null when no decision was recorded', () => {
        expect(resolveVisibleFundingDecision(null, new Date('2026-11-01T00:00:00Z'), now)).toBeNull();
    });
});
