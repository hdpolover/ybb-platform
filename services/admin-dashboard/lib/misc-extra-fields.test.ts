// services/admin-dashboard/lib/misc-extra-fields.test.ts
import { describe, expect, it } from "vitest";
import type { SubmissionFormFieldAdmin, SubmissionSectionAdmin } from "@/src/shared/api-client";
import { getMiscExtraFields } from "./misc-extra-fields";

const field = (over: Partial<SubmissionFormFieldAdmin>): SubmissionFormFieldAdmin => ({
  name: "x",
  label: "X",
  type: "text",
  store: "personalData",
  section: "miscellaneous",
  isRequired: false,
  value: "",
  readonly: false,
  order: 0,
  ...over,
});

const sections = (fields: SubmissionFormFieldAdmin[]): SubmissionSectionAdmin[] => [
  { section: "miscellaneous", label: "Miscellaneous", fields },
  { section: "essay", label: "Essay", fields: [field({ name: "e", section: "essay", value: "essay text" })] },
];

describe("getMiscExtraFields", () => {
  it("returns [] when the form or section is missing", () => {
    expect(getMiscExtraFields(undefined)).toEqual([]);
    expect(getMiscExtraFields([{ section: "essay", label: "E", fields: [] }])).toEqual([]);
  });

  it("skips fields already shown by the fixed rows", () => {
    const out = getMiscExtraFields(
      sections([
        field({ name: "twibbon_link", value: "https://t.co/a" }),
        field({ name: "knowledge_source", value: "Instagram" }),
      ]),
    );
    expect(out).toEqual([]);
  });

  it("returns answered extra fields in order, dropping unanswered ones", () => {
    const out = getMiscExtraFields(
      sections([
        field({ name: "alumni_program", label: "Which YBB program did you join?", value: "IYS 2024", order: 52 }),
        field({ name: "alumni_status", label: "Are you an alumni of a YBB program?", type: "select", value: "Yes", order: 51 }),
        field({ name: "alumni_year", label: "Which year?", value: "  ", order: 53 }),
      ]),
    );
    expect(out.map((f) => f.name)).toEqual(["alumni_status", "alumni_program"]);
  });

  it("flags http(s) url-type values as links only", () => {
    const out = getMiscExtraFields(
      sections([
        field({ name: "portfolio", type: "url", value: "https://x.dev", order: 1 }),
        field({ name: "portfolio2", type: "url", value: "not a url", order: 2 }),
      ]),
    );
    expect(out.map((f) => f.isLink)).toEqual([true, false]);
  });
});
