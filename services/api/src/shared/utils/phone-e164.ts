// services/api/src/shared/utils/phone-e164.ts

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Combine a stored country code and phone number into an E.164-ish string
 * (e.g. "+6281234567890") suitable for display, export, and contacting users.
 *
 * Handles the common storage variations:
 * - number already in international "+..." form -> returned as-is
 * - country code with or without a leading "+"
 * - local numbers with leading zeros (stripped when a country code is present)
 */
export function buildE164Phone(
  countryCode: string | null | undefined,
  phoneNumber: string | null | undefined,
): string | undefined {
  if (!phoneNumber) return undefined;

  const digits = String(phoneNumber).trim();
  if (!digits) return undefined;
  if (digits.startsWith('+')) return digits;

  if (!countryCode) return digits;

  const normalizedCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
  const normalizedNumber = digits.replace(/^0+/, '') || digits;
  return `${normalizedCode}${normalizedNumber}`;
}

/**
 * Participants capture their phone in the application form (`personal_data` JSON),
 * NOT on the participant record — that column is unused in prod. Form templates
 * differ per program, so the phone lands under one of two shapes:
 * - `phone`: a single, already-international value (e.g. "+77019569041")
 * - `phone_number` (+ optional `phone_country_code`): split fields
 *
 * Returns an E.164-ish string, or undefined when no phone was provided.
 */
export function extractPhoneFromPersonalData(
  personalData: unknown,
): string | undefined {
  if (!personalData || typeof personalData !== 'object') return undefined;
  const pd = personalData as Record<string, unknown>;

  const single = typeof pd.phone === 'string' ? pd.phone.trim() : '';
  if (single) return buildE164Phone(undefined, single);

  const countryCode =
    typeof pd.phone_country_code === 'string' ? pd.phone_country_code : undefined;
  const phoneNumber =
    typeof pd.phone_number === 'string' ? pd.phone_number : undefined;
  return buildE164Phone(countryCode, phoneNumber);
}

/**
 * Result of {@link sanitizePhone}: `value` is either a validated E.164 number
 * or the untouched raw input — callers must NEVER treat an invalid `value` as
 * a corrected/guessed number, it's just what the user/import gave us.
 */
export interface SanitizedPhone {
  value: string;
  isValid: boolean;
}

/**
 * Parse + validate a raw phone string with `libphonenumber-js`, using
 * `regionHint` (an ISO-3166 alpha-2 code, e.g. from `personal_data.nationality`)
 * to resolve ambiguous national-format numbers (no leading "+").
 *
 * Never fabricates a corrected number: on any failure (unparseable, invalid,
 * or a throw from the underlying library on malformed input) the original
 * `raw` string is returned unchanged with `isValid: false`.
 */
export function sanitizePhone(
  raw: string | undefined,
  regionHint?: string,
): SanitizedPhone {
  const trimmed = raw?.trim();
  if (!trimmed) return { value: '-', isValid: false };

  try {
    const parsed = trimmed.startsWith('+')
      ? parsePhoneNumberFromString(trimmed)
      : parsePhoneNumberFromString(trimmed, regionHint?.toUpperCase() as CountryCode);

    if (parsed?.isValid()) {
      return { value: parsed.number, isValid: true };
    }
  } catch {
    // Malformed input can throw (e.g. bad region code) — fall through to the
    // same "keep raw, mark invalid" outcome as a failed parse.
  }

  return { value: trimmed, isValid: false };
}

/**
 * Combinator: pull the raw phone candidate out of `personal_data` (whichever
 * of the two form shapes was used) and the `nationality` region hint, then
 * sanitize/validate it. See {@link extractPhoneFromPersonalData} for the
 * shape handling and {@link sanitizePhone} for the parse/validate rules.
 */
export function extractAndSanitizePhone(personalData: unknown): SanitizedPhone {
  const raw = extractPhoneFromPersonalData(personalData);

  const nationality =
    personalData && typeof personalData === 'object'
      ? (personalData as Record<string, unknown>).nationality
      : undefined;
  const regionHint = typeof nationality === 'string' ? nationality : undefined;

  return sanitizePhone(raw, regionHint);
}
