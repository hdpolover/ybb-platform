// src/shared/utils/reminder-message-tokens.util.ts

/**
 * Token substitution for admin-drafted participant reminder subjects/bodies.
 *
 * Uses the same `{{token}}` convention the rest of the platform already
 * writes: DocumentTemplate.placeholders (see buildLoaPlaceholderData in
 * loa-render-payload.util.ts) and the managed email templates rendered by
 * services/notification both key off `{{...}}`.
 *
 * It is NOT Handlebars, deliberately. The admin body is arbitrary prose typed
 * into a textarea; running it through hbs.compile() would turn a stray `{{`
 * into a template-compile exception at send time — i.e. a whole reminder
 * failing because someone wrote "{{ see attached }}". This does a literal,
 * total replacement of the known tokens and leaves everything else verbatim.
 *
 * MIRRORED in services/notification at
 * src/common/utils/reminder-message-tokens.ts, which is what actually renders
 * the outgoing mail. That service has no dependency on this one (same reason
 * truncateSendError is duplicated on both sides), so the copies must be kept
 * in step by hand. The API's copy exists so the admin preview shows exactly
 * what will be sent.
 */

export interface ReminderTokenValues {
  participantName: string;
  programName: string;
}

/** The tokens an admin may use, in the order the UI offers them. */
export const REMINDER_BODY_TOKENS = ['{{participant_name}}', '{{program_name}}'] as const;

// One pass over the source, so a substituted value is never itself rescanned
// for tokens. Chained .split().join() calls would substitute the participant
// name and then go looking for tokens inside it. A replacer FUNCTION (not a
// replacement string) is also what stops a `$&` in someone's name from being
// interpreted as a backreference.
const REMINDER_TOKEN_PATTERN = /\{\{(participant_name|program_name)\}\}/g;

export function renderReminderTokens(text: string, values: ReminderTokenValues): string {
  return text.replace(REMINDER_TOKEN_PATTERN, (_match, token: string) =>
    token === 'participant_name' ? values.participantName : values.programName,
  );
}
