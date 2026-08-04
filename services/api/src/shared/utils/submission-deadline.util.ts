// src/shared/utils/submission-deadline.util.ts

import { addDays, startOfWibDay, wibDateKey } from './wib-time';

/**
 * Single source of truth for "can this application still be submitted",
 * given Program.applicationDeadline.
 *
 * Enforced but decorative for a long time: the deadline was shown in the
 * participant UI and mentioned in a reminder email, but nothing on the
 * submit path checked it (see submit-application.handler.ts /
 * portal-submit-application.handler.ts). This util is the shared gate that
 * closes that gap.
 *
 * application_deadline is stored as an instant that represents a WIB
 * CALENDAR DAY, not a precise cutoff. Most rows are midnight UTC
 * (07:00 WIB), but not all (a test program uses 23:59:59 UTC instead).
 * Enforcing the raw stored instant literally would cut off part of the
 * deadline's own WIB day for anyone in Jakarta - a participant submitting at
 * 10:00 WIB on the deadline date itself would be blocked, losing almost the
 * whole final day. That caused a real production lockout before when a
 * different date field (registration_close_date) was misapplied - see
 * decisionsForHuman notes.
 *
 * The rule, regardless of which shape the stored instant is in: take its WIB
 * CALENDAR DATE and allow submission through 23:59:59.999 WIB on that date.
 *
 * Used by every submit entry point (submit-application.handler.ts,
 * portal-submit-application.handler.ts) AND by
 * SubmissionDeadlineReminderService, so "the last day you can submit" and
 * the reminder's "H-1" day can never drift apart.
 */

/**
 * The instant AT OR AFTER which submission is no longer allowed (exclusive
 * upper bound - submission is allowed for any `now < cutoff`).
 *
 * Returns null when the program has no deadline, meaning submission is
 * unrestricted. Never treat null as "already past due" - callers must check
 * for null before comparing against `now`.
 */
export function resolveSubmissionCutoff(
  applicationDeadline: Date | null | undefined,
): Date | null {
  if (!applicationDeadline) return null;
  // Midnight WIB of the day AFTER the deadline's own WIB calendar day, i.e.
  // one millisecond past 23:59:59.999 WIB on the deadline's WIB date.
  return addDays(startOfWibDay(applicationDeadline), 1);
}

/**
 * True once `now` has reached or passed the submission cutoff. Always false
 * when the program has no deadline (unrestricted).
 */
export function isPastSubmissionDeadline(
  applicationDeadline: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const cutoff = resolveSubmissionCutoff(applicationDeadline);
  return cutoff !== null && now.getTime() >= cutoff.getTime();
}

/**
 * Human-readable, program-and-date-specific message for the 4xx thrown when
 * a late submission is rejected. Named the program and the WIB deadline date
 * explicitly so the participant (or the admin reading a support ticket)
 * understands exactly what happened, not just "submission failed".
 */
export function formatSubmissionDeadlineMessage(
  programName: string,
  applicationDeadline: Date,
): string {
  return (
    `The submission deadline for "${programName}" was ${wibDateKey(applicationDeadline)} ` +
    `(WIB). This application can no longer be submitted.`
  );
}
