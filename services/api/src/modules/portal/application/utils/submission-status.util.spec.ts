// services/api/src/modules/portal/application/utils/submission-status.util.spec.ts
import { buildSubmissionChecklist, isSubmissionClosed } from './submission-status.util';

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

    it('is closed for a draft with no open category window and a passed program deadline', () => {
        expect(isSubmissionClosed('draft', null, past, now)).toBe(true);
    });

    it('is open while the program deadline is ahead (gap between category windows)', () => {
        expect(isSubmissionClosed('draft', null, future, now)).toBe(false);
    });

    it('is open while the category has an active window', () => {
        expect(isSubmissionClosed('draft', future, past, now)).toBe(false);
    });

    it('stays open through the deadline day itself (WIB calendar day rule)', () => {
        // Deadline stored as 2026-11-09T00:00Z = 07:00 WIB; cutoff is the end of that WIB day.
        expect(isSubmissionClosed('draft', null, new Date('2026-11-09T00:00:00Z'), now)).toBe(false);
    });

    it('is open when the program has no deadline', () => {
        expect(isSubmissionClosed('draft', null, null, now)).toBe(false);
    });

    it('is never closed once submitted', () => {
        expect(isSubmissionClosed('submitted', null, past, now)).toBe(false);
    });
});
