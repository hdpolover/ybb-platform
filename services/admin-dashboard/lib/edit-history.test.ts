// services/admin-dashboard/lib/edit-history.test.ts
import { describe, expect, it } from "vitest";
import type { SubmissionSectionAdmin } from "@/src/shared/api-client";
import { buildChangeLabels, changeLabel, EMPTY_VALUE, formatChangeValue, isLongValue } from "./edit-history";

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
