// services/admin-dashboard/lib/country-options.test.ts
import { describe, expect, it } from "vitest";
import {
  buildCountryOptions,
  getCountryOptions,
  isCountryField,
  NON_STANDARD_SUFFIX,
} from "./country-options";

describe("isCountryField", () => {
  it("detects type 'country' case-insensitively", () => {
    expect(isCountryField({ name: "x", type: "country" })).toBe(true);
    expect(isCountryField({ name: "x", type: "Country" })).toBe(true);
  });

  it("detects the text + country_select variant", () => {
    expect(isCountryField({ name: "x", type: "text", inputType: "country_select" })).toBe(true);
    expect(isCountryField({ name: "x", type: "text", inputType: "COUNTRY_SELECT" })).toBe(true);
  });

  it("falls back to portal-style nationality field names", () => {
    expect(isCountryField({ name: "nationality", type: "text" })).toBe(true);
    expect(isCountryField({ name: "current_country", type: "text" })).toBe(true);
    expect(isCountryField({ name: "originCountry", type: "text" })).toBe(true);
  });

  it("rejects ordinary fields", () => {
    expect(isCountryField({ name: "city", type: "text" })).toBe(false);
    expect(isCountryField({ name: "x", type: "text", inputType: "phone_country_code" })).toBe(false);
    expect(isCountryField({ name: "country_of_birth_notes", type: "textarea" })).toBe(false);
  });
});

describe("getCountryOptions", () => {
  const options = getCountryOptions();

  it("uses uppercase alpha-2 codes as values and names as labels", () => {
    const za = options.find((o) => o.value === "ZA");
    expect(za?.label).toBe("South Africa");
    expect(options.every((o) => /^[A-Z]{2}$/.test(o.value))).toBe(true);
  });

  it("excludes deprecated aliases and non-country regions", () => {
    const codes = new Set(options.map((o) => o.value));
    for (const bad of ["UK", "AN", "SU", "EU", "UN", "ZZ"]) expect(codes.has(bad)).toBe(false);
    expect(codes.has("GB")).toBe(true);
    expect(codes.has("XK")).toBe(true);
  });

  it("has no duplicate codes and is sorted by label", () => {
    expect(new Set(options.map((o) => o.value)).size).toBe(options.length);
    const labels = options.map((o) => o.label);
    expect([...labels].sort((a, b) => a.localeCompare(b, "en"))).toEqual(labels);
  });
});

describe("buildCountryOptions", () => {
  const standard = getCountryOptions();

  it("returns the plain list for an empty value", () => {
    expect(buildCountryOptions("")).toEqual(standard);
    expect(buildCountryOptions("   ")).toEqual(standard);
  });

  it("returns the plain list for a known ISO code", () => {
    expect(buildCountryOptions("ZA")).toEqual(standard);
  });

  it("preserves a legacy free-text value as a labelled extra option", () => {
    const result = buildCountryOptions("South African");
    expect(result[0]).toEqual({
      value: "South African",
      label: `South African${NON_STANDARD_SUFFIX}`,
    });
    expect(result.slice(1)).toEqual(standard);
  });

  it("treats lowercase codes as non-standard and keeps them selectable", () => {
    const result = buildCountryOptions("za");
    expect(result[0]?.value).toBe("za");
    expect(result).toHaveLength(standard.length + 1);
  });

  it("does not mutate the cached standard list", () => {
    buildCountryOptions("Nowhere");
    expect(getCountryOptions()).toHaveLength(standard.length);
  });
});
