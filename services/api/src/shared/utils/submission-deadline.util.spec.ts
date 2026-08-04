// src/shared/utils/submission-deadline.util.spec.ts

import {
    formatSubmissionDeadlineMessage,
    isPastSubmissionDeadline,
    resolveSubmissionCutoff,
} from './submission-deadline.util';

describe('submission-deadline.util', () => {
    describe('resolveSubmissionCutoff', () => {
        it('returns null when there is no deadline', () => {
            expect(resolveSubmissionCutoff(null)).toBeNull();
            expect(resolveSubmissionCutoff(undefined)).toBeNull();
        });

        it('resolves a midnight-UTC deadline to WIB midnight of the following day', () => {
            // Istanbul Youth Summit 2027 shape: '2026-08-31 00:00:00+00'.
            // WIB calendar day = 31 Aug (07:00 WIB that morning). Cutoff = WIB
            // midnight 1 Sep, i.e. 2026-08-31T17:00:00Z.
            const deadline = new Date('2026-08-31T00:00:00Z');
            expect(resolveSubmissionCutoff(deadline)?.toISOString()).toBe(
                '2026-08-31T17:00:00.000Z',
            );
        });

        it('resolves a 23:59:59-UTC deadline (the TEST-program shape) the same way', () => {
            // 23:59:59 UTC on 1 Aug is 06:59:59 WIB on 2 Aug, so the WIB calendar
            // day is 2 Aug, not 1 Aug. Cutoff = WIB midnight 3 Aug.
            const deadline = new Date('2026-08-01T23:59:59Z');
            expect(resolveSubmissionCutoff(deadline)?.toISOString()).toBe(
                '2026-08-02T17:00:00.000Z',
            );
        });
    });

    describe('isPastSubmissionDeadline - boundary', () => {
        // Deadline stored as WIB midnight of 31 Aug 2026 (2026-08-30T17:00:00Z).
        const deadline = new Date('2026-08-30T17:00:00.000Z'); // WIB midnight, 31 Aug

        it('PASSES at 23:59:59.999 WIB on the deadline day itself', () => {
            // 23:59:59.999 WIB on 31 Aug = 16:59:59.999 UTC on 31 Aug.
            const now = new Date('2026-08-31T16:59:59.999Z');
            expect(isPastSubmissionDeadline(deadline, now)).toBe(false);
        });

        it('FAILS at exactly 00:00:00 WIB the next day', () => {
            // 00:00:00 WIB on 1 Sep = 17:00:00 UTC on 31 Aug.
            const now = new Date('2026-08-31T17:00:00.000Z');
            expect(isPastSubmissionDeadline(deadline, now)).toBe(true);
        });

        it('FAILS well after the deadline', () => {
            const now = new Date('2026-09-15T00:00:00Z');
            expect(isPastSubmissionDeadline(deadline, now)).toBe(true);
        });

        it('PASSES well before the deadline', () => {
            const now = new Date('2026-01-01T00:00:00Z');
            expect(isPastSubmissionDeadline(deadline, now)).toBe(false);
        });
    });

    describe('isPastSubmissionDeadline - no deadline', () => {
        it('is always false when applicationDeadline is null', () => {
            expect(isPastSubmissionDeadline(null, new Date('2099-01-01Z'))).toBe(false);
        });

        it('is always false when applicationDeadline is undefined', () => {
            expect(isPastSubmissionDeadline(undefined, new Date('2099-01-01Z'))).toBe(false);
        });
    });

    describe('isPastSubmissionDeadline - defaults to Date.now()', () => {
        it('uses the current time when now is not supplied', () => {
            const farFuture = new Date('2999-01-01T00:00:00Z');
            expect(isPastSubmissionDeadline(farFuture)).toBe(false);

            const farPast = new Date('2000-01-01T00:00:00Z');
            expect(isPastSubmissionDeadline(farPast)).toBe(true);
        });
    });

    describe('formatSubmissionDeadlineMessage', () => {
        it('names both the program and the WIB deadline date', () => {
            const deadline = new Date('2026-08-30T17:00:00.000Z'); // WIB midnight, 31 Aug
            const message = formatSubmissionDeadlineMessage('Istanbul Youth Summit 2027', deadline);

            expect(message).toContain('Istanbul Youth Summit 2027');
            expect(message).toContain('2026-08-31');
        });
    });
});
