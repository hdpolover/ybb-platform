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

    describe('rule (c): applicationDeadline >= registrationCloseDate', () => {
        it('rejects applicationDeadline earlier than registrationCloseDate, with the consequence and fix location', () => {
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationCloseDate: new Date('2026-12-05T16:59:00.000Z'),
                    applicationDeadline: new Date('2026-08-31T00:00:00.000Z'),
                }),
            ).toThrow(
                'Application Deadline (31 Aug 2026) cannot be earlier than Registration Closes (5 Dec 2026), ' +
                    'because anyone who registers after 31 Aug 2026 would never be able to submit. ' +
                    'Change Registration Closes in Program Details, Program Specifics.',
            );
        });

        it('accepts applicationDeadline on or after registrationCloseDate', () => {
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationCloseDate: new Date('2026-12-05T00:00:00Z'),
                    applicationDeadline: new Date('2026-12-05T00:00:00Z'),
                }),
            ).not.toThrow();
            expect(() =>
                assertProgramDeadlineOrder({
                    registrationCloseDate: new Date('2026-12-05T00:00:00Z'),
                    applicationDeadline: new Date('2026-12-06T00:00:00Z'),
                }),
            ).not.toThrow();
        });

        it('skips the check when either value is null', () => {
            expect(() =>
                assertProgramDeadlineOrder({ registrationCloseDate: null, applicationDeadline: new Date() }),
            ).not.toThrow();
            expect(() =>
                assertProgramDeadlineOrder({ registrationCloseDate: new Date(), applicationDeadline: undefined }),
            ).not.toThrow();
        });
    });

    it('passes with no dates at all', () => {
        expect(() => assertProgramDeadlineOrder({})).not.toThrow();
    });
});
