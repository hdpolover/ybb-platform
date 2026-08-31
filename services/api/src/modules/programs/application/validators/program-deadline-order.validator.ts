// file: services/api/src/modules/programs/application/validators/program-deadline-order.validator.ts
import { BadRequestException } from '@nestjs/common';
import { WIB_TIME_ZONE } from '@shared/utils/wib-time';

/**
 * Enforces the three date orderings a program's registration/application
 * window must satisfy:
 *   a) registrationCloseDate >= registrationOpenDate
 *   b) applicationDeadline   >= registrationOpenDate
 *   c) applicationDeadline   >= registrationCloseDate
 *
 * Rationale for (c): registrationCloseDate gates CREATING an application;
 * applicationDeadline gates SUBMITTING it. A deadline earlier than the close
 * date means anyone who registers in the gap between the two can never
 * submit. A prior incident that conflated these two fields locked ~130
 * participants out, so this only reorders (c), it does not change which
 * field gates what.
 *
 * Each rule is skipped when either of its two values is null/absent, so an
 * already-misconfigured program stays editable on unrelated fields (see the
 * update-program handler, which only calls this when the payload actually
 * touches one of the three date fields, merged onto the existing record).
 *
 * Evidence: as of 2026-08-30, 0 of 27 live programs violate any of these
 * three rules, so none of them can be blocked from saving by this check.
 */
export function assertProgramDeadlineOrder(dates: {
  registrationOpenDate?: Date | null;
  registrationCloseDate?: Date | null;
  applicationDeadline?: Date | null;
}): void {
  const { registrationOpenDate, registrationCloseDate, applicationDeadline } = dates;

  if (
    registrationCloseDate &&
    registrationOpenDate &&
    registrationCloseDate.getTime() < registrationOpenDate.getTime()
  ) {
    throw new BadRequestException(
      `Registration Closes (${formatWibDate(registrationCloseDate)}) cannot be earlier than ` +
        `Registration Opens (${formatWibDate(registrationOpenDate)}), because registration ` +
        `would close before it opens. Change these dates in Program Details, Program Specifics.`,
    );
  }

  if (
    applicationDeadline &&
    registrationOpenDate &&
    applicationDeadline.getTime() < registrationOpenDate.getTime()
  ) {
    throw new BadRequestException(
      `Application Deadline (${formatWibDate(applicationDeadline)}) cannot be earlier than ` +
        `Registration Opens (${formatWibDate(registrationOpenDate)}), because no one could ` +
        `submit before registration even opens. Change these dates in Program Details, Program Specifics.`,
    );
  }

  if (
    applicationDeadline &&
    registrationCloseDate &&
    applicationDeadline.getTime() < registrationCloseDate.getTime()
  ) {
    throw new BadRequestException(
      `Application Deadline (${formatWibDate(applicationDeadline)}) cannot be earlier than ` +
        `Registration Closes (${formatWibDate(registrationCloseDate)}), because anyone who ` +
        `registers after ${formatWibDate(applicationDeadline)} would never be able to submit. ` +
        `Change Registration Closes in Program Details, Program Specifics.`,
    );
  }
}

/** Formats an instant as its WIB calendar date, e.g. "5 Dec 2026". */
function formatWibDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
