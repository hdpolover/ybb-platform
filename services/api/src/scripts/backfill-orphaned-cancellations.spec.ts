// services/api/src/scripts/backfill-orphaned-cancellations.spec.ts
import { classifyOrphan } from './backfill-orphaned-cancellations';

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
