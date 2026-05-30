/**
 * English-only input restriction utilities.
 *
 * Two-tier rule:
 *  - "name"    : A-Za-z, space, hyphen, apostrophe, period only.
 *               Blocks diacritics, non-Latin scripts, emoji, and
 *               all other symbols.
 *  - "general" : Printable ASCII (\x20-\x7E) + tab/newline/carriage-return.
 *               Blocks diacritics, non-Latin scripts, emoji.
 */

export type RestrictMode = "name" | "general";

/** Pattern for characters that are NOT allowed in name mode. */
const NAME_DISALLOWED = /[^A-Za-z .'\-]/g;

/** Pattern for characters that are NOT allowed in general mode. */
const GENERAL_DISALLOWED = /[^\x20-\x7E\n\r\t]/g;

export interface SanitizeResult {
  /** The cleaned value with disallowed characters removed. */
  value: string;
  /** Unique disallowed characters that were stripped (for user feedback). */
  removed: string[];
}

/**
 * Sanitize a string by removing disallowed characters for the given mode.
 * Returns both the cleaned value and the list of unique removed characters.
 */
export function sanitize(value: string, mode: RestrictMode): SanitizeResult {
  // Use fresh RegExp per call with the `g` flag to avoid lastIndex state issues.
  const pattern = mode === "name"
    ? new RegExp(NAME_DISALLOWED.source, "g")
    : new RegExp(GENERAL_DISALLOWED.source, "g");

  const removedChars = new Set<string>();
  const cleaned = value.replace(pattern, (char) => {
    removedChars.add(char);
    return "";
  });

  return {
    value: cleaned,
    removed: Array.from(removedChars),
  };
}

/**
 * Returns true if the value contains any disallowed characters for the given mode.
 * Useful for conditional rendering of warnings without sanitizing.
 */
export function hasDisallowed(value: string, mode: RestrictMode): boolean {
  const pattern = mode === "name"
    ? new RegExp(NAME_DISALLOWED.source)
    : new RegExp(GENERAL_DISALLOWED.source);
  return pattern.test(value);
}
