import {
    extractTopLevelStatus,
    isSettledStatus,
    isTerminalNonSettledStatus,
    isAwaitingReviewStatus,
} from './gateway-transaction-status.util';

describe('gateway-transaction-status.util', () => {
    describe('extractTopLevelStatus', () => {
        it('reads a top-level transaction status', () => {
            expect(extractTopLevelStatus({ status: 'pending' })).toBe('PENDING');
        });

        it('returns empty string for a missing/null payload', () => {
            expect(extractTopLevelStatus(null)).toBe('');
        });
    });

    describe('isSettledStatus', () => {
        it.each(['SUCCESS', 'SUCCEEDED'])('treats %s as settled', (status) => {
            expect(isSettledStatus(status)).toBe(true);
        });

        it.each(['PENDING', 'NEEDS_REVIEW', 'VOID', 'FAILED', ''])('treats %s as not settled', (status) => {
            expect(isSettledStatus(status)).toBe(false);
        });
    });

    describe('isTerminalNonSettledStatus', () => {
        it.each(['FAILED', 'VOID', 'REJECTED', 'CANCELED'])('treats %s as terminal-non-settled', (status) => {
            expect(isTerminalNonSettledStatus(status)).toBe(true);
        });

        it.each(['PENDING', 'NEEDS_REVIEW', 'SUCCESS', ''])('treats %s as NOT terminal-non-settled', (status) => {
            expect(isTerminalNonSettledStatus(status)).toBe(false);
        });
    });

    describe('isAwaitingReviewStatus', () => {
        it.each(['NEEDS_REVIEW', 'needs_review'])('treats %s as awaiting review', (status) => {
            expect(isAwaitingReviewStatus(status)).toBe(true);
        });

        it.each(['PENDING', 'SUCCESS', 'VOID', ''])('treats %s as NOT awaiting review', (status) => {
            expect(isAwaitingReviewStatus(status)).toBe(false);
        });
    });
});
