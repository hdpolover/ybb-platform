// src/modules/reminders/reminder.constants.ts

/**
 * Audiences a participant reminder can target. Exactly one exists today; the
 * whole module is shaped so the next one is a new audience service plus one
 * entry here and in the migration's CHECK constraint.
 */
export const REMINDER_AUDIENCES = {
  REGISTRATION_FEE_UNPAID: 'registration_fee_unpaid',
} as const;

export type ReminderAudience = (typeof REMINDER_AUDIENCES)[keyof typeof REMINDER_AUDIENCES];

export const REMINDER_AUDIENCE_VALUES: readonly string[] = Object.values(REMINDER_AUDIENCES);

/**
 * Lifecycle of a reminder record. Every transition is performed as a
 * conditional updateMany guarded on the current status, so the database — not
 * timing — is what makes dispatch at-most-once.
 */
export const REMINDER_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  SENT: 'sent',
  CANCELLED: 'cancelled',
} as const;

export type ReminderStatus = (typeof REMINDER_STATUS)[keyof typeof REMINDER_STATUS];

/** Statuses an admin may still edit or cancel. */
export const REMINDER_EDITABLE_STATUSES: readonly ReminderStatus[] = [
  REMINDER_STATUS.DRAFT,
  REMINDER_STATUS.SCHEDULED,
];

export const REMINDER_SEND_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export type ReminderSendStatus =
  (typeof REMINDER_SEND_STATUS)[keyof typeof REMINDER_SEND_STATUS];

// error_message is TEXT, but an unbounded provider stack trace in an audit row
// helps nobody and bloats the read endpoint's payload. Mirrors
// MAX_SEND_ERROR_LENGTH in loa-batch-recipient-send.repository.ts.
export const MAX_REMINDER_SEND_ERROR_LENGTH = 500;

export function truncateReminderSendError(error: string): string {
  return error.length > MAX_REMINDER_SEND_ERROR_LENGTH
    ? `${error.slice(0, MAX_REMINDER_SEND_ERROR_LENGTH - 1)}…`
    : error;
}

/**
 * The audience preview rides along with the admin screen on every load, so the
 * list it returns is capped for payload size; the count returned beside it is
 * the true total. Same treatment as UNCOVERED_PARTICIPANT_LIST_LIMIT.
 */
export const REMINDER_AUDIENCE_PREVIEW_LIMIT = 200;
