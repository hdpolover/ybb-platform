// src/modules/reminders/reminder.constants.ts

/**
 * Audiences a participant reminder can target. The module is shaped so the
 * next one is a new audience service (implementing ReminderAudienceAdapter)
 * plus one entry here, one in ReminderAudienceRegistry, and one in the
 * migration's CHECK constraint — never an if-chain.
 */
export const REMINDER_AUDIENCES = {
  REGISTRATION_FEE_UNPAID: 'registration_fee_unpaid',
  APPLICATION_DRAFT_UNSUBMITTED: 'application_draft_unsubmitted',
  PROGRAM_FEE_UNPAID: 'program_fee_unpaid',
} as const;

export type ReminderAudience = (typeof REMINDER_AUDIENCES)[keyof typeof REMINDER_AUDIENCES];

export const REMINDER_AUDIENCE_VALUES: readonly string[] = Object.values(REMINDER_AUDIENCES);

/**
 * `application_draft_unsubmitted` is the SAME population
 * PostPaymentFollowupService already emails automatically, three days after
 * the registration-fee payment lands (see
 * src/modules/applications/infrastructure/services/post-payment-followup.service.ts).
 * That cron additionally requires the payment to postdate
 * POST_PAYMENT_FOLLOWUP_CUTOFF and claims each application via
 * postPaymentFollowupSentAt so it never repeats — an admin reminder built on
 * this audience does not reproduce either rule, so the two can genuinely
 * target the same person. Surfaced to the create-reminder UI as a
 * non-blocking heads-up: it must not block sending, since an admin may want a
 * manual follow-up (extra urgency, a personal note) even after the automated
 * nudge already went out.
 */
export const REMINDER_AUDIENCE_OVERLAP_NOTES: Partial<Record<ReminderAudience, string>> = {
  [REMINDER_AUDIENCES.APPLICATION_DRAFT_UNSUBMITTED]:
    'These participants may already have received an automated submission reminder ' +
    '(sent 3 days after their registration payment). This manual reminder will still send.',
};

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

export const REMINDER_STATUS_VALUES: readonly string[] = Object.values(REMINDER_STATUS);

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

/** Defaults/caps for GET :programId/reminders pagination. */
export const REMINDER_LIST_DEFAULT_LIMIT = 20;
export const REMINDER_LIST_MAX_LIMIT = 100;
