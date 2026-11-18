// file: services/api/src/modules/programs/application/validators/program-deadline-order.validator.spec.ts
import { BadRequestException } from '@nestjs/common';
import { assertProgramDeadlineOrder } from './program-deadline-order.validator';

describe('program-deadline-order.validator', () => {
    describe('rule (a): registrationCloseDate >= registrationOpenDate', () => {
        it('rejects registrationCloseDate earlier than registrationOpenDate', () => {
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationOpenDate: new Date('2026-12-10T00:00:00Z'),
                    registrationCloseDate: new Date('2026-12-05T00:00:00Z'),
                }),
            ).toThrow(BadRequestException);
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationOpenDate: new Date('2026-12-10T00:00:00Z'),
                    registrationCloseDate: new Date('2026-12-05T00:00:00Z'),
                }),
            ).toThrow(/Registration Closes.*cannot be earlier than.*Registration Opens/s);
        });

        it('accepts registrationCloseDate on or after registrationOpenDate', () => {
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationOpenDate: new Date('2026-12-05T00:00:00Z'),
                    registrationCloseDate: new Date('2026-12-05T00:00:00Z'),
                }),
            ).not.toThrow();
        });

        it('skips the check when either value is null', () => {
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationOpenDate: null,
                    registrationCloseDate: new Date('2026-12-05T00:00:00Z'),
                }),
            ).not.toThrow();
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationOpenDate: new Date('2026-12-05T00:00:00Z'),
                    registrationCloseDate: undefined,
                }),
            ).not.toThrow();
        });
    });

    describe('rule (b): applicationDeadline >= registrationOpenDate', () => {
        it('rejects applicationDeadline earlier than registrationOpenDate', () => {
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationOpenDate: new Date('2026-12-10T00:00:00Z'),
                    applicationDeadline: new Date('2026-12-05T00:00:00Z'),
                }),
            ).toThrow(/Application Deadline.*cannot be earlier than.*Registration Opens/s);
        });

        it('accepts applicationDeadline on or after registrationOpenDate', () => {
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationOpenDate: new Date('2026-12-05T00:00:00Z'),
                    applicationDeadline: new Date('2026-12-05T00:00:00Z'),
                }),
            ).not.toThrow();
        });

        it('skips the check when either value is null', () => {
            expect(() =>
                assertProgramDeadlineOrder({ registrationOpenDate: null, applicationDeadline: new Date() }),
            ).not.toThrow();
            expect(() =>
                assertProgramDeadlineOrder({ registrationOpenDate: new Date(), applicationDeadline: undefined }),
            ).not.toThrow();
        });
    });

    describe('applicationDeadline vs registrationCloseDate', () => {
        it('allows a deadline before registration closes (H-2 is a valid business choice)', () => {
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationOpenDate: new Date('2026-11-20T16:59:00.000Z'),
                    registrationCloseDate: new Date('2027-06-28T16:59:00.000Z'),
                    applicationDeadline: new Date('2027-06-26T00:00:00.000Z'),
                }),
            ).not.toThrow();
        });
    });

    it('passes with no dates at all', () => {
        expect(() => assertProgramDeadlineOrder({})).not.toThrow();
    });
});
