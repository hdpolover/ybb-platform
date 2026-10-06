// services/admin-dashboard/lib/registration-status.ts

/**
 * Derives the admin-facing registration status for a program. Mirrors the
 * order the API gates on (isProgramRegistrationOpen in the auth module): the
 * allowRegistration switch is checked before the dates, so a program whose
 * window is open can still be refusing every signup.
 */
import { formatInBusinessTz, parseToInstant } from "./datetime.ts";

export type RegistrationStatus = "Disabled" | "Scheduled" | "Open" | "Closed";

export type RegistrationStatusInput = {
  allowRegistration: boolean;
  registrationOpenDate?: string | null;
  registrationCloseDate?: string | null;
};

const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

function toTime(value?: string | null): number | null {
  if (!value) return null;
  const time = parseToInstant(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** What the open/close dates alone say, ignoring the allowRegistration switch. */
function getWindowStatus(input: RegistrationStatusInput, now: Date): Exclude<RegistrationStatus, "Disabled"> {
  const openTime = toTime(input.registrationOpenDate);
  const closeTime = toTime(input.registrationCloseDate);

  if (openTime !== null && now.getTime() < openTime) return "Scheduled";
  if (closeTime !== null && now.getTime() > closeTime) return "Closed";
  return "Open";
}

export function getRegistrationStatus(input: RegistrationStatusInput, now: Date = new Date()): RegistrationStatus {
  return input.allowRegistration ? getWindowStatus(input, now) : "Disabled";
}

/**
 * One line saying what is gating registration, so an admin can tell why at a
 * glance without opening the edit drawer. Null when registration is open.
 */
export function getRegistrationStatusReason(input: RegistrationStatusInput, now: Date = new Date()): string | null {
  const status = getRegistrationStatus(input, now);

  if (status === "Disabled") {
    return "Accept registrations is switched off, so the dates are ignored.";
  }

  if (status === "Scheduled" && input.registrationOpenDate) {
    return `Opens ${formatInBusinessTz(input.registrationOpenDate, DATETIME_OPTS)} WIB`;
  }

  if (status === "Closed" && input.registrationCloseDate) {
    return `Closed since ${formatInBusinessTz(input.registrationCloseDate, DATETIME_OPTS)} WIB`;
  }

  return null;
}

/**
 * The allowRegistration part of an update payload: present only when the admin
 * actually flipped the switch. The edit drawer works from a snapshot taken at
 * page load, so echoing an untouched value back would overwrite a change made
 * meanwhile on Settings > Main Configuration.
 */
export function buildAllowRegistrationPatch(loaded: boolean, submitted: boolean): { allowRegistration?: boolean } {
  return loaded === submitted ? {} : { allowRegistration: submitted };
}

/**
 * True when a registration window is configured and currently open but the
 * switch is off: the dates promise participants an open registration that the
 * switch is refusing. Programs with no window at all are left alone, since
 * completed and legacy programs sit switched-off permanently.
 */
export function isSwitchedOffDuringOpenWindow(input: RegistrationStatusInput, now: Date = new Date()): boolean {
  if (input.allowRegistration) return false;

  const hasWindow = toTime(input.registrationOpenDate) !== null || toTime(input.registrationCloseDate) !== null;
  return hasWindow && getWindowStatus(input, now) === "Open";
}
