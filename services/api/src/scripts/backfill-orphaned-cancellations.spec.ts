// services/api/src/scripts/backfill-orphaned-cancellations.spec.ts
import { classifyOrphan, classifyFetchOutcome, decidePostVoidRecheck } from './backfill-orphaned-cancellations';

describe('classifyOrphan', () => {
    it('classifies a live PENDING transaction as void', () => {
        expect(classifyOrphan('PENDING')).toBe('void');
    });

    it('classifies a live NEEDS_REVIEW transaction as void', () => {
        expect(classifyOrphan('NEEDS_REVIEW')).toBe('void');
    });

    it('classifies an already-VOID transaction as skip_already_terminal', () => {
        expect(classifyOrphan('VOID')).toBe('skip_already_terminal');
    });

    it('classifies a FAILED transaction as skip_already_terminal', () => {
        expect(classifyOrphan('FAILED')).toBe('skip_already_terminal');
    });

    it('classifies a SUCCESS transaction as danger_settled — the 1 danger case', () => {
        expect(classifyOrphan('SUCCESS')).toBe('danger_settled');
    });

    it('classifies an unfetchable/null status as skip_no_reference', () => {
        expect(classifyOrphan(null)).toBe('skip_no_reference');
    });
});

describe('classifyFetchOutcome', () => {
    it('classifies HTTP 401 as auth_failure', () => {
        expect(classifyFetchOutcome(401)).toBe('auth_failure');
    });

    it('classifies HTTP 403 as auth_failure', () => {
        expect(classifyFetchOutcome(403)).toBe('auth_failure');
    });

    it('classifies HTTP 404 as not_found', () => {
        expect(classifyFetchOutcome(404)).toBe('not_found');
    });

    it('classifies HTTP 200 as ok', () => {
        expect(classifyFetchOutcome(200)).toBe('ok');
    });

    it('classifies HTTP 500 as other_failure', () => {
        expect(classifyFetchOutcome(500)).toBe('other_failure');
    });

    it('classifies a thrown network error sentinel as other_failure', () => {
        expect(classifyFetchOutcome('network_error')).toBe('other_failure');
    });

    it('classifies an unexpected HTTP 418 as other_failure (not auth, not silently ok)', () => {
        expect(classifyFetchOutcome(418)).toBe('other_failure');
    });
});

describe('decidePostVoidRecheck', () => {
    it('treats a re-checked skip_already_terminal (genuinely already VOID/FAILED) as safe to record as voided', () => {
        expect(decidePostVoidRecheck('skip_already_terminal')).toEqual({ action: 'treat_as_voided' });
    });

    it('flags a re-checked danger_settled (SUCCESS in the race window) as danger — never silently reconciled', () => {
        expect(decidePostVoidRecheck('danger_settled')).toEqual({ action: 'flag_danger' });
    });

    it('defaults to flag_danger for an ambiguous re-check (still void/live) rather than assuming safety', () => {
        expect(decidePostVoidRecheck('void')).toEqual({ action: 'flag_danger' });
    });

    it('defaults to flag_danger for an unchecked/unfetchable re-check rather than assuming safety', () => {
        expect(decidePostVoidRecheck('unchecked_error')).toEqual({ action: 'flag_danger' });
    });
});
