// services/admin-dashboard/lib/country-options.ts
/**
 * Country select options for the admin Edit-Submission drawer.
 *
 * Nationality / country answers are stored as uppercase ISO 3166-1 alpha-2
 * codes (ZA, IN, ...). The dashboard has no country dataset dependency, so the
 * list is derived from the runtime's CLDR data (Intl.DisplayNames) — the same
 * source the participant pages already use for code -> name display.
 *
 * Intl alone is not a country list: sweeping AA..ZZ also yields deprecated
 * aliases (UK, AN, SU, ...) and non-country regions (EU, UN, ZZ, ...). Aliases
 * are dropped via locale canonicalisation; the remainder is a small deny-list.
 * The result is the 249 ISO countries plus XK (Kosovo, user-assigned but what
 * the participant portal also offers).
 */
import type { SubmissionFormFieldAdmin } from "@/src/shared/api-client";

export type CountryOption = { value: string; label: string };

export const NON_STANDARD_SUFFIX = " (non-standard value)";

/** CLDR regions that are not countries and have no ISO 3166-1 alpha-2 code. */
const NON_COUNTRY_REGIONS: ReadonlySet<string> = new Set([
  "AC", "CP", "CQ", "DG", "EA", "EU", "EZ", "IC", "QO", "TA", "UN", "XA", "XB", "ZZ",
]);

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const COUNTRY_FIELD_NAMES: ReadonlySet<string> = new Set([
  "nationality",
  "nationalitycode",
  "origincountry",
  "currentcountry",
]);

type CountryFieldShape = Pick<SubmissionFormFieldAdmin, "name" | "type"> & {
  inputType?: string;
};

/**
 * Mirrors ybb-program-next SubmissionEditSection.isCountrySelectorField so the
 * admin and participant surfaces agree on what a country field is: type
 * 'country', validationRules.inputType 'country_select', or a well-known name.
 */
export function isCountryField(field: CountryFieldShape): boolean {
  if (field.type.toLowerCase() === "country") return true;
  if (field.inputType?.toLowerCase() === "country_select") return true;
  return COUNTRY_FIELD_NAMES.has(field.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
}

let cachedOptions: ReadonlyArray<CountryOption> | null = null;

function computeCountryOptions(): CountryOption[] {
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  const options: CountryOption[] = [];
  for (const first of LETTERS) {
    for (const second of LETTERS) {
      const code = `${first}${second}`;
      if (NON_COUNTRY_REGIONS.has(code)) continue;
      if (Intl.getCanonicalLocales(`und-${code}`)[0] !== `und-${code}`) continue;
      const label = names.of(code);
      if (!label || label === code) continue;
      options.push({ value: code, label });
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, "en"));
}

/** Standard options: ISO alpha-2 value, English country name label. */
export function getCountryOptions(): ReadonlyArray<CountryOption> {
  cachedOptions ??= computeCountryOptions();
  return cachedOptions;
}

/**
 * Options for one field. A stored value that is not a known ISO code (legacy
 * free text such as "South African", or a lowercase code) is kept as an extra,
 * clearly labelled option so the select shows it instead of silently blanking
 * it — the admin only changes it by choosing something else.
 */
export function buildCountryOptions(currentValue: string): CountryOption[] {
  const standard = getCountryOptions();
  if (currentValue.trim() === "") return [...standard];
  if (standard.some((option) => option.value === currentValue)) return [...standard];
  return [
    { value: currentValue, label: `${currentValue.trim()}${NON_STANDARD_SUFFIX}` },
    ...standard,
  ];
}
