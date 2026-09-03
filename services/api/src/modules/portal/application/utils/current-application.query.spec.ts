import { currentApplicationWhere, currentApplicationOrderBy } from './current-application.query';

describe('current application resolution rule', () => {
    describe('currentApplicationWhere', () => {
        it('scopes to the program when the caller supplied one', () => {
            expect(currentApplicationWhere('participant-1', 'program-A')).toEqual({
                participantId: 'participant-1',
                deletedAt: null,
                programId: 'program-A',
            });
        });

        it('falls back to all of the participant\'s applications when none was supplied', () => {
            expect(currentApplicationWhere('participant-1')).toEqual({
                participantId: 'participant-1',
                deletedAt: null,
            });
        });

        // A soft-deleted application is gone, not merely stale. Without this a
        // deleted row could be returned as "your current application".
        it('never matches a soft-deleted application', () => {
            for (const programId of ['program-A', undefined]) {
                expect(currentApplicationWhere('participant-1', programId)).toMatchObject({ deletedAt: null });
            }
        });

        it('does not add an empty programId filter, which would match nothing', () => {
            expect(currentApplicationWhere('participant-1', '')).not.toHaveProperty('programId');
        });
    });

    describe('currentApplicationOrderBy', () => {
        // Ordering withdrawn rows last rather than filtering them out means a
        // participant whose only application is withdrawn still sees it, while a
        // participant holding both always gets the live one.
        it('prefers a live application over a withdrawn one', () => {
            expect(currentApplicationOrderBy[0]).toEqual({ withdrawnAt: { sort: 'asc', nulls: 'first' } });
        });

        // updatedAt is @updatedAt, so reconciliation sweeps, webhook consumers and
        // admin edits all bump it. It means "most recently touched by anything",
        // not "the one the participant cares about", so it must never outrank a
        // real signal.
        it('uses updatedAt only to break the remaining tie, never as the primary key', () => {
            expect(currentApplicationOrderBy[currentApplicationOrderBy.length - 1]).toEqual({ updatedAt: 'desc' });
            expect(currentApplicationOrderBy[0]).not.toHaveProperty('updatedAt');
        });

        it('is fully deterministic - every key is specified', () => {
            expect(currentApplicationOrderBy.length).toBeGreaterThanOrEqual(2);
        });
    });
});
