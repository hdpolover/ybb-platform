// src/common/utils/reminder-message-tokens.ts

/**
 * Token substitution for admin-drafted participant reminder subjects/bodies.
 *
 * Uses the same `{{token}}` convention the rest of the platform already
 * writes (document-template placeholders, managed email templates).
 *
 * It is NOT Handlebars, deliberately. The admin body is arbitrary prose typed
 * into a textarea; running it through hbs.compile() would turn a stray `{{`
 * into a template-compile exception at send time — i.e. a whole reminder
 * failing because someone wrote "{{ see attached }}". This does a literal,
 * total replacement of the known tokens and leaves everything else verbatim.
 *
 * MIRRORED in services/api at src/shared/utils/reminder-message-tokens.util.ts,
 * which the admin preview renders with so the preview and the outgoing mail
 * cannot disagree. This service intentionally has no dependency on the API
 * (same reason truncateSendError is duplicated on both sides), so the two
 * copies are kept in step by hand.
 */

export interface ReminderTokenValues {
  participantName: string;
  programName: string;
}

// One pass over the source, so a substituted value is never itself rescanned
// for tokens. Chained .split().join() calls would substitute the participant
// name and then go looking for tokens inside it. A replacer FUNCTION (not a
// replacement string) is also what stops a `$&` in someone's name from being
// interpreted as a backreference.
const REMINDER_TOKEN_PATTERN = /\{\{(participant_name|program_name)\}\}/g;

export function renderReminderTokens(
  text: string,
  values: ReminderTokenValues,
): string {
  return text.replace(REMINDER_TOKEN_PATTERN, (_match, token: string) =>
    token === 'participant_name' ? values.participantName : values.programName,
  );
}
