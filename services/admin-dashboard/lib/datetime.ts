/**
 * Centralized timezone handling for the admin dashboard.
 *
 * YBB is operated from Indonesia, so all program / payment scheduling is authored
 * and displayed in a single canonical business timezone (WIB, Asia/Jakarta), not
 * the admin's ambient browser timezone. Relying on the browser timezone meant the
 * same "23:59" deadline was stored as a different instant depending on where the
 * admin's machine happened to be set (e.g. China Youth Summit was entered from a
 * UTC context and stored as 23:59 UTC, while Middle East Youth Summit was entered
 * from WIB and stored as 16:59 UTC). When rendered back in WIB that off-by-7-hours
 * pushed end-of-day deadlines onto the next calendar day ("15 July" -> "16 July").
 *
 * The stored value is always an absolute UTC instant; these helpers only govern
 * the wall-clock <-> instant conversion at the input and display boundaries so the
 * result is deterministic no matter where the admin is.
 *
 * Note: Asia/Jakarta is a fixed UTC+7 with no DST, so the single-step offset
 * computation below is exact. If a DST zone were ever used here, this would need a
 * second offset iteration near transitions.
 */

export const BUSINESS_TIMEZONE = "Asia/Jakarta";

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Wall-clock components of an instant as seen in a given IANA timezone. */
function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  // Some engines emit hour "24" at midnight; normalize to 0.
  if (map.hour === 24) map.hour = 0;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/** Offset (ms) that `timeZone` is ahead of UTC at the given instant. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Parse a backend date value to a Date; assumes UTC when no offset is present. */
export function parseToInstant(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value === null || value === undefined) return new Date(NaN);
  const raw = String(value).trim();
  if (!raw) return new Date(NaN);
  // Date-only -> anchor at UTC midnight; callers render in the business timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00Z`);
  const hasTz = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  return new Date(hasTz ? raw : `${raw}Z`);
}

/**
 * Convert a `datetime-local` input value (wall-clock in the business timezone)
 * to a UTC ISO string for the API. Returns null for empty/invalid input.
 */
export function zonedInputToUtcIso(
  value: string | null | undefined,
  timeZone: string = BUSINESS_TIMEZONE,
): string | null {
  if (!value) return null;
  const m = DATETIME_LOCAL_RE.exec(value.trim());
  if (!m) {
    // Value already carries timezone info (or another parseable form), so normalize.
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const [, y, mo, d, h, mi, s] = m;
  // Interpret the typed components AS the business-timezone wall clock.
  const wallAsUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  const offset = tzOffsetMs(new Date(wallAsUtc), timeZone);
  return new Date(wallAsUtc - offset).toISOString();
}

/**
 * Convert a UTC/ISO backend value to a `datetime-local` input value showing the
 * wall clock in the business timezone. Returns "" for empty/invalid input.
 */
export function utcToZonedInput(
  value: string | Date | null | undefined,
  timeZone: string = BUSINESS_TIMEZONE,
): string {
  const d = parseToInstant(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = getZonedParts(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Format an instant for display in the business timezone. Returns "—" if invalid. */
export function formatInBusinessTz(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  timeZone: string = BUSINESS_TIMEZONE,
): string {
  const d = parseToInstant(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(d);
}
