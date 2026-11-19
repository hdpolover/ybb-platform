// services/admin-dashboard/lib/edit-history.test.ts
import { describe, expect, it } from "vitest";
import type { SubmissionSectionAdmin } from "@/src/shared/api-client";
import {
  buildChangeFields,
  buildChangeLabels,
  changeField,
  changeLabel,
  EMPTY_VALUE,
  formatChangeValue,
  isLongValue,
  originalValuesByKey,
} from "./edit-history";

describe("formatChangeValue with a field", () => {
  it("formats strings like the rest of the page", () => {
    expect(formatChangeValue("PK", { name: "nationality" })).toBe("Pakistan");
    expect(formatChangeValue("2005-12-29", { name: "birthdate" })).toBe("29 December 2005");
    expect(formatChangeValue("", { name: "nationality" })).toBe(EMPTY_VALUE);
  });
});

describe("changeField", () => {
  const fields = buildChangeFields([
    { section: "p", label: "P", fields: [{ name: "gender", label: "Gender", type: "select", store: "personalData", section: "p", isRequired: false, value: "", readonly: false, order: 1, options: [{ value: "m", label: "Male" }] }] },
  ]);

  it("uses the form field for a known key and the bare field name otherwise", () => {
    expect(formatChangeValue("m", changeField("personalData.gender", fields))).toBe("Male");
    expect(changeField("personalData.home_country", fields)).toEqual({ name: "home_country" });
    expect(changeField("participant", fields)).toEqual({ name: "participant" });
  });
});

describe("originalValuesByKey", () => {
  const entries = [
    // Newest first, as the API sends them.
    { editedAt: "2026-11-10T09:00:00Z", changes: [{ key: "personalData.nationality", old: "ID", new: "MY" }] },
    {
      editedAt: "2026-11-01T09:00:00Z",
      changes: [
        { key: "personalData.nationality", old: "PK", new: "ID" },
        { key: "personalData.city", old: null, new: "Lahore" },
      ],
    },
  ];

  it("takes the old value of the earliest edit per key, formatted", () => {
    const originals = originalValuesByKey(entries, new Map());
    expect(originals.get("personalData.nationality")).toBe("Pakistan");
    expect(originals.get("personalData.city")).toBe(EMPTY_VALUE);
    expect(originals.has("personalData.gender")).toBe(false);
  });

  it("does not depend on the API's ordering", () => {
    expect(originalValuesByKey([...entries].reverse(), new Map()).get("personalData.nationality")).toBe("Pakistan");
  });

  it("is empty without history", () => {
    expect(originalValuesByKey([], new Map()).size).toBe(0);
  });
});

const field = (name: string, label: string, store: "personalData" | "essayAnswers") => ({
  name, label, store, type: "text", section: "s", isRequired: false, value: "", readonly: false, order: 1,
});

const sections: SubmissionSectionAdmin[] = [
  { section: "personal_details", label: "Personal", fields: [field("phone_number", "WhatsApp number", "personalData")] },
  { section: "essay", label: "Essay", fields: [field("motivation", "Why do you want to join?", "essayAnswers")] },
];
const essayId = "3f2b8c1e-9d4a-4b6f-8a21-0c5e7d9f1a23";
const essays = [{ id: essayId, question: `${"Describe a challenge you overcame ".repeat(4)}and what you learned` }];
const labels = buildChangeLabels(sections, essays);

describe("changeLabel", () => {
  it("resolves personalData and essayAnswers keys against the form labels", () => {
    expect(changeLabel("personalData.phone_number", labels)).toBe("WhatsApp number");
    expect(changeLabel("essayAnswers.motivation", labels)).toBe("Why do you want to join?");
  });

  it("resolves an essay uuid to its question, truncated", () => {
    const label = changeLabel(`essayAnswers.${essayId}`, labels);
    expect(label.startsWith("Describe a challenge")).toBe(true);
    expect(label.endsWith("…")).toBe(true);
    expect(label.length).toBeLessThanOrEqual(60);
  });

  it("names fixed and column keys", () => {
    expect(changeLabel("participant.fullName", labels)).toBe("Full name");
    expect(changeLabel("application.twibbonLink", labels)).toBe("Twibbon link");
    expect(changeLabel("personalData.knowledge_source", labels)).toBe("Knowledge source");
  });

  it("does not show a raw uuid for an essay that is no longer on the program", () => {
    expect(changeLabel("essayAnswers.11111111-2222-4333-8444-555555555555", labels)).toBe("Essay answer");
  });

  it("works without form or essays", () => {
    expect(changeLabel("personalData.city", buildChangeLabels(undefined, undefined))).toBe("City");
  });
});

describe("formatChangeValue", () => {
  it("passes strings through and marks blanks as empty", () => {
    expect(formatChangeValue("Jakarta")).toBe("Jakarta");
    expect(formatChangeValue("  ")).toBe(EMPTY_VALUE);
    expect(formatChangeValue(null)).toBe(EMPTY_VALUE);
    expect(formatChangeValue(undefined)).toBe(EMPTY_VALUE);
  });

  it("stringifies non-strings, with empty containers as empty", () => {
    expect(formatChangeValue(0)).toBe("0");
    expect(formatChangeValue(false)).toBe("false");
    expect(formatChangeValue(["a", "b"])).toBe('["a","b"]');
    expect(formatChangeValue({ role: "Lead" })).toBe('{"role":"Lead"}');
    expect(formatChangeValue([])).toBe(EMPTY_VALUE);
    expect(formatChangeValue({})).toBe(EMPTY_VALUE);
  });
});

describe("isLongValue", () => {
  it("flags long or many-line text only", () => {
    expect(isLongValue("short")).toBe(false);
    expect(isLongValue("x".repeat(161))).toBe(true);
    expect(isLongValue("a\nb\nc\nd")).toBe(true);
  });
});
