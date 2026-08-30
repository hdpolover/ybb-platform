// file: services/api/src/modules/programs/application/validators/program-deadline-order.validator.spec.ts
import { BadRequestException } from '@nestjs/common';
import { assertDeadlineNotBeforeRegistrationClose } from './program-deadline-order.validator';

describe('program-deadline-order.validator', () => {
    it('rejects applicationDeadline earlier than registrationCloseDate', () => {
        const applicationDeadline = new Date('2026-01-01T00:00:00Z');
        const registrationCloseDate = new Date('2026-01-10T00:00:00Z');

        expect(() =>
            assertDeadlineNotBeforeRegistrationClose(applicationDeadline, registrationCloseDate),
        ).toThrow(BadRequestException);
        expect(() =>
            assertDeadlineNotBeforeRegistrationClose(applicationDeadline, registrationCloseDate),
        ).toThrow(/applicationDeadline.*registrationCloseDate/);
    });

    it('accepts applicationDeadline on or after registrationCloseDate', () => {
        const registrationCloseDate = new Date('2026-01-10T00:00:00Z');
        expect(() =>
            assertDeadlineNotBeforeRegistrationClose(registrationCloseDate, registrationCloseDate),
        ).not.toThrow();
        expect(() =>
            assertDeadlineNotBeforeRegistrationClose(
                new Date('2026-01-11T00:00:00Z'),
                registrationCloseDate,
            ),
        ).not.toThrow();
    });

    it('skips the check when applicationDeadline is missing', () => {
        expect(() =>
            assertDeadlineNotBeforeRegistrationClose(null, new Date('2026-01-10T00:00:00Z')),
        ).not.toThrow();
    });

    it('skips the check when registrationCloseDate is missing', () => {
        expect(() =>
            assertDeadlineNotBeforeRegistrationClose(new Date('2026-01-10T00:00:00Z'), null),
        ).not.toThrow();
    });

    it('skips the check when both are missing', () => {
        expect(() => assertDeadlineNotBeforeRegistrationClose(undefined, undefined)).not.toThrow();
    });
});
