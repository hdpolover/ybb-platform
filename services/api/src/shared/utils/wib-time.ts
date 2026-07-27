// src/shared/utils/wib-time.ts

/**
 * Day-boundary helpers pinned to WIB (Asia/Jakarta, UTC+7).
 *
 * Admin analytics are read by a Jakarta-based team, so a "day" in the dashboard
 * has to mean a WIB calendar day. Bucketing on UTC midnight shifted every
 * figure by seven hours: anything created between 00:00 and 07:00 WIB was
 * counted against the previous day. That is how the China Youth Summit overview
 * reported 0 registrations for 15/07/2026 when 24 people had in fact registered
 * that morning, before a separate outage closed registration at 07:00 WIB.
 *
 * WIB is a fixed +07:00 offset with no daylight saving (unchanged since 1964),
 * so arithmetic on a constant offset is exact and avoids per-call Intl work.
 */
export const WIB_TIME_ZONE = 'Asia/Jakarta';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Shifts an instant so its WIB wall clock can be read through the getUTC* accessors. */
const toWibWallClock = (date: Date): Date => new Date(date.getTime() + WIB_OFFSET_MS);

/** Inverse of toWibWallClock: turns a WIB wall clock back into a real instant. */
const fromWibWallClock = (date: Date): Date => new Date(date.getTime() - WIB_OFFSET_MS);

/** The instant at which the WIB calendar day containing `date` began. */
export function startOfWibDay(date: Date): Date {
  const wall = toWibWallClock(date);
  return fromWibWallClock(
    new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate())),
  );
}

/** The instant at which the WIB week containing `date` began. Weeks start Monday. */
export function startOfWibWeek(date: Date): Date {
  const daysFromMonday = (toWibWallClock(date).getUTCDay() + 6) % 7;
  return addDays(startOfWibDay(date), -daysFromMonday);
}

/** The instant at which the WIB calendar month containing `date` began. */
export function startOfWibMonth(date: Date): Date {
  const wall = toWibWallClock(date);
  return fromWibWallClock(new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1)));
}

/** Exact because WIB never shifts: a day is always 24h long. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Adds calendar months, landing on WIB midnight of the 1st. */
export function addWibMonths(date: Date, months: number): Date {
  const wall = toWibWallClock(date);
  return fromWibWallClock(
    new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth() + months, 1)),
  );
}

/** The WIB calendar date of an instant, as YYYY-MM-DD. */
export function wibDateKey(date: Date): string {
  return toWibWallClock(date).toISOString().slice(0, 10);
}

/**
 * Parses an admin filter date. A bare YYYY-MM-DD means a WIB calendar day, so
 * it is anchored to WIB midnight rather than the UTC midnight `new Date()`
 * would produce. A value carrying an explicit time or offset is already an
 * absolute instant and is passed through untouched.
 */
export function parseWibFilterDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return parsed;
  return DATE_ONLY_PATTERN.test(value.trim()) ? fromWibWallClock(parsed) : parsed;
}
