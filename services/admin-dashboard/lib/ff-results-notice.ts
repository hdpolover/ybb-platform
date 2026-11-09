// services/admin-dashboard/lib/ff-results-notice.ts
import { formatInBusinessTz, parseToInstant } from "./datetime.ts";

const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/**
 * The portal only shows an applicant their Fully Funded result once the
 * program's announcement date has passed. Returns the amber notice text when
 * results exist but applicants cannot see them yet, otherwise null.
 */
export function getFfResultsHiddenNotice(input: {
  hasDecisions: boolean;
  announcedAt: string | null | undefined;
  now?: Date;
}): string | null {
  if (!input.hasDecisions) return null;
  const announced = input.announcedAt ? parseToInstant(input.announcedAt) : null;
  const hasValidDate = announced !== null && !Number.isNaN(announced.getTime());
  if (hasValidDate && announced.getTime() <= (input.now ?? new Date()).getTime()) return null;
  const when = hasValidDate ? `${formatInBusinessTz(announced, DATETIME_OPTS)} WIB` : "not set";
  return `FF results are hidden from applicants until the announcement date (${when}). Set it in program settings.`;
}
