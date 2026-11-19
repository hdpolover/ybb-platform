// services/admin-dashboard/lib/field-value-format.ts
// Display text for stored participant answers on the admin participant page:
// option labels, ISO country codes -> names, ISO dates -> "29 December 2005",
// snake_case option codes -> "High School". Free text is returned unchanged.
import type { SubmissionFormFieldAdmin } from "@/src/shared/api-client";
import { isCountryField } from "@/lib/country-options";
import { formatDate } from "@/lib/utils";

/** What the formatter needs to know about a field; a bare `{ name }` works for fixed rows without a form field. */
export type FieldFormatShape = Pick<SubmissionFormFieldAdmin, "name"> &
  Partial<Pick<SubmissionFormFieldAdmin, "type" | "inputType" | "options">>;

const LONG_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
const DATE_TYPES: ReadonlySet<string> = new Set(["date", "datetime", "date_input"]);
const DATE_NAMES: ReadonlySet<string> = new Set(["birthdate", "date_of_birth"]);
const OPTION_TYPES: ReadonlySet<string> = new Set(["select", "radio", "dropdown"]);
// Fixed-row fields that store option codes ("bachelors", "male") even on forms that don't define the field.
const OPTION_NAMES: ReadonlySet<string> = new Set([
  "gender", "education_level", "tshirt_size", "knowledge_source", "referral_source", "category",
]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const OPTION_CODE_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const SIZE_CODE_RE = /^\d?x{0,3}[sml]$/i;
// Uppercase only: stored codes are ISO upper-case, and lowercase "na"/"no" in free text means N/A, not Namibia/Norway.
const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
const COUNTRY_NAME_RE = /(?:^|_)country$/i;

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region", fallback: "none" })
    : null;

/** "PK" -> "Pakistan"; names, unknown codes and blanks come back trimmed but otherwise as-is. */
export function formatCountry(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!regionNames || !COUNTRY_CODE_RE.test(value)) return value;
  try {
    return regionNames.of(value) ?? value;
  } catch {
    return value;
  }
}

/** "2005-12-29" -> "29 December 2005" in the business timezone (a date-only value keeps its calendar day); anything else as-is. */
export function formatDateValue(raw: string): string {
  const value = raw.trim();
  if (!ISO_DATE_RE.test(value)) return value;
  const out = formatDate(value, LONG_DATE);
  return out === "—" ? value : out;
}

/** "high_school" -> "High School", "bachelors" -> "Bachelors"; anything with spaces, capitals or punctuation is left alone. */
export function humanizeOptionCode(raw: string): string {
  const value = raw.trim();
  if (!OPTION_CODE_RE.test(value)) return value;
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isDateField(f: FieldFormatShape): boolean {
  return DATE_TYPES.has((f.type ?? "").toLowerCase()) || DATE_NAMES.has(f.name.toLowerCase());
}

function isCountry(f: FieldFormatShape): boolean {
  return isCountryField({ name: f.name, type: f.type ?? "", inputType: f.inputType }) || COUNTRY_NAME_RE.test(f.name);
}

function isOptionField(f: FieldFormatShape): boolean {
  // The name list only stands in when the form doesn't type the field; a text question stays free text.
  return (f.options?.length ?? 0) > 0 || OPTION_TYPES.has((f.type ?? "").toLowerCase()) || (!f.type && OPTION_NAMES.has(f.name.toLowerCase()));
}

/** One stored value as an admin should read it. Unknown shapes fall through unchanged. */
export function formatFieldValue(raw: string | null | undefined, field: FieldFormatShape): string {
  const value = (raw ?? "").trim();
  if (value === "") return "";
  const option = field.options?.find((o) => o.value.trim() === value);
  if (option?.label.trim()) return option.label.trim();
  if (isCountry(field)) return formatCountry(value);
  if (isDateField(field)) return formatDateValue(value);
  if (!isOptionField(field)) return value;
  if (/size/i.test(field.name) && SIZE_CODE_RE.test(value)) return value.toUpperCase();
  return humanizeOptionCode(value);
}
