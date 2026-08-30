// file: services/api/src/modules/programs/application/validators/program-deadline-order.validator.ts
import { BadRequestException } from '@nestjs/common';

/**
 * `registrationCloseDate` gates application CREATION; `applicationDeadline`
 * gates SUBMISSION. Nothing enforced that submission couldn't be configured
 * to close before registration does — an admin could set applicationDeadline
 * earlier than registrationCloseDate, locking out anyone who registers in
 * that gap. This only rejects that one clearly-wrong ordering; it does not
 * change which field gates what (a prior incident conflating the two fields
 * locked out ~130 participants).
 *
 * Either field missing/null skips the check — both are optional/nullable.
 */
export function assertDeadlineNotBeforeRegistrationClose(
  applicationDeadline: Date | null | undefined,
  registrationCloseDate: Date | null | undefined,
): void {
  if (!applicationDeadline || !registrationCloseDate) return;
  if (applicationDeadline.getTime() < registrationCloseDate.getTime()) {
    throw new BadRequestException(
      `applicationDeadline (${applicationDeadline.toISOString()}) must not be earlier than registrationCloseDate (${registrationCloseDate.toISOString()}).`,
    );
  }
}
