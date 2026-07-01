// services/api/src/shared/utils/phone-e164.ts

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
