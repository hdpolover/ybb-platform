// file: services/api/src/modules/programs/application/validators/program-deadline-order.validator.ts
import { BadRequestException } from '@nestjs/common';
import { WIB_TIME_ZONE } from '@shared/utils/wib-time';

/**
 * Enforces the two date orderings that can never be a valid configuration:
 *   a) registrationCloseDate >= registrationOpenDate
 *   b) applicationDeadline   >= registrationOpenDate
 *
 * Deliberately NOT enforced: applicationDeadline >= registrationCloseDate.
 * registrationCloseDate gates CREATING an application and applicationDeadline
 * gates SUBMITTING it, so a deadline a few days before close (CYS wants H-2)
 * means anyone registering in the gap cannot submit. That is a legitimate
 * business choice, so the admin UI warns about it instead of blocking. The
 * rule was also timezone-fragile: the deadline is a date-only value (UTC
 * midnight) compared against a WIB datetime close, so even a same-day
 * deadline was rejected.
 *
 * Each rule is skipped when either of its two values is null/absent, so an
 * already-misconfigured program stays editable on unrelated fields (see the
 * update-program handler, which only calls this when the payload actually
 * touches one of the three date fields, merged onto the existing record).
 *
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
