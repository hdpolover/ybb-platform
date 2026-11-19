// services/admin-dashboard/lib/form-extra-fields.test.ts
import { describe, expect, it } from "vitest";
import type { SubmissionFormFieldAdmin, SubmissionSectionAdmin } from "@/src/shared/api-client";
import { getExtraFieldsByTab, getFieldDisplayValue, getSubmittedSections } from "./form-extra-fields";

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

const section = (id: string, fields: SubmissionFormFieldAdmin[]): SubmissionSectionAdmin => ({
  section: id,
  label: id,
  fields,
});

describe("getExtraFieldsByTab", () => {
  it("returns empty buckets when there is no form", () => {
    const empty = { personal: [], professional: [], entry: [], misc: [] };
    expect(getExtraFieldsByTab(undefined)).toEqual(empty);
    expect(getExtraFieldsByTab([section("miscellaneous", [])])).toEqual(empty);
  });

  it("maps sections to tabs and sends unknown sections to misc", () => {
    const out = getExtraFieldsByTab([
      section("personal_details", [field({ name: "a", value: "1" })]),
      section("personal_info", [field({ name: "b", value: "2" })]),
      section("contact_information", [field({ name: "c", value: "3" })]),
      section("professional_profile", [field({ name: "d", value: "4" })]),
      section("entry_information", [field({ name: "e", value: "5" })]),
      section("essay", [field({ name: "f", value: "6" })]),
      section("miscellaneous", [field({ name: "g", value: "7" })]),
      section("additional_info", [field({ name: "h", value: "8" })]),
    ]);
    expect(out.personal.map((f) => f.name)).toEqual(["a", "b", "c"]);
    expect(out.professional.map((f) => f.name)).toEqual(["d"]);
    expect(out.entry.map((f) => f.name)).toEqual(["e", "f"]);
    expect(out.misc.map((f) => f.name)).toEqual(["g", "h"]);
  });

  it("skips covered names in every tab", () => {
    const out = getExtraFieldsByTab([
      section("personal_details", [field({ name: "full_name", value: "A" }), field({ name: "phone", value: "+1" })]),
      section("professional_profile", [field({ name: "occupation", value: "Dev" }), field({ name: "cv_upload", value: "x" })]),
      section("entry_information", [field({ name: "category", value: "ff" }), field({ name: "essay_guidelines", value: "https://g.co" })]),
      section("miscellaneous", [field({ name: "twibbon_link", value: "https://t.co/a" }), field({ name: "knowledge_source", value: "ig" })]),
    ]);
    expect(out).toEqual({ personal: [], professional: [], entry: [], misc: [] });
  });

  it("returns answered fields in order, trimmed, dropping unanswered ones", () => {
    const out = getExtraFieldsByTab([
      section("miscellaneous", [
        field({ name: "alumni_program", label: "Program", value: "IYS 2024 ", order: 52 }),
        field({ name: "alumni_status", label: "Alumni?", value: "Yes", order: 51 }),
        field({ name: "alumni_year", label: "Year", value: "  ", order: 53 }),
      ]),
    ]);
    expect(out.misc.map((f) => [f.name, f.value])).toEqual([
      ["alumni_status", "Yes"],
      ["alumni_program", "IYS 2024"],
    ]);
  });

  it("shows the option label for select fields, falling back to the raw value", () => {
    const options = [{ label: "Instagram", value: "instagram" }];
    const out = getExtraFieldsByTab([
      section("miscellaneous", [
        field({ name: "a", type: "select", value: "instagram ", options, order: 1 }),
        field({ name: "b", type: "radio", value: "other", options, order: 2 }),
      ]),
    ]);
    expect(out.misc.map((f) => f.value)).toEqual(["Instagram", "other"]);
  });

  it("flags http(s) values as links regardless of field type", () => {
    const out = getExtraFieldsByTab([
      section("miscellaneous", [
        field({ name: "p1", type: "url", value: "https://x.dev", order: 1 }),
        field({ name: "p2", type: "text", value: "https://y.dev", order: 2 }),
        field({ name: "p3", type: "url", value: "not a url", order: 3 }),
      ]),
    ]);
    expect(out.misc.map((f) => f.isLink)).toEqual([true, true, false]);
  });
});

describe("getFieldDisplayValue", () => {
  it("returns the option label for a named field, or undefined when unanswered", () => {
    const sections = [
      section("miscellaneous", [
        field({ name: "knowledge_source", value: "instagram", options: [{ label: "Instagram", value: "instagram" }] }),
        field({ name: "blank", value: " " }),
      ]),
    ];
    expect(getFieldDisplayValue(sections, "knowledge_source")).toBe("Instagram");
    expect(getFieldDisplayValue(sections, "blank")).toBeUndefined();
    expect(getFieldDisplayValue(undefined, "x")).toBeUndefined();
  });
});

describe("getSubmittedSections", () => {
  it("returns [] when there is no form", () => {
    expect(getSubmittedSections(undefined)).toEqual([]);
  });

  it("keeps every field in order, including unanswered ones, with option labels and link flags", () => {
    const out = getSubmittedSections([
      section("misc", [
        field({ name: "b", label: "B", order: 2, value: "https://x.test/cv" }),
        field({ name: "a", label: "A", order: 1, value: "" }),
        field({ name: "c", label: "C", order: 3, value: "ig", options: [{ label: "Instagram", value: "ig" }] }),
      ]),
    ]);
    expect(out).toEqual([
      {
        section: "misc",
        label: "misc",
        fields: [
          { name: "a", label: "A", value: "", isLink: false },
          { name: "b", label: "B", value: "https://x.test/cv", isLink: true },
          { name: "c", label: "C", value: "Instagram", isLink: false },
        ],
      },
    ]);
  });
});
