// services/admin-dashboard/lib/payment-method-code.ts
/**
 * Derives the stable machine `code` for a shared payment method from its
 * admin-entered name. Extracted from the payment-methods page so the
 * truncation logic is a small, pure, unit-testable helper instead of an
 * inline expression.
 */

// payment_methods.code is varchar(50) in Postgres (see the Go
// PaymentMethodEntity). A code past this length doesn't fail validation,
// it fails the INSERT with a raw "value too long for type character
// varying(50)" (22001), which the admin sees as an opaque 500. Cap
// generated codes here so that can't happen.
export const PAYMENT_METHOD_CODE_MAX_LENGTH = 50;
// Suffix shape is "_" + 6 random base36 chars, reserve that much room.
const PAYMENT_METHOD_CODE_SUFFIX_LENGTH = 7;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Builds the stable machine `code` for a shared payment method.
 *
 * - On edit, the existing code is returned untouched (renaming a method
 *   shouldn't break anything keyed off its code).
 * - On create, the code is derived from the admin-entered name, truncated
 *   so the full string (slug + random suffix) never exceeds
 *   PAYMENT_METHOD_CODE_MAX_LENGTH. Any trailing underscore left by the
 *   truncation is stripped so we never emit a double-underscore right
 *   before the suffix (e.g. `foo_bar__ab12cd`).
 * - The random 6-char suffix keeps creates collision-resistant since the
 *   column has a unique constraint.
 */
export function buildPaymentMethodCode(name: string, existingCode?: string | null): string {
  if (existingCode) return existingCode;
  const suffix = `_${Math.random().toString(36).slice(2, 8)}`;
  const maxSlugLength = PAYMENT_METHOD_CODE_MAX_LENGTH - PAYMENT_METHOD_CODE_SUFFIX_LENGTH;
  const slug = slugify(name).slice(0, maxSlugLength).replace(/_+$/, "");
  return `${slug}${suffix}`;
}
