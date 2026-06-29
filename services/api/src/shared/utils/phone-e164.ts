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
