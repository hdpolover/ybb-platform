// services/admin-dashboard/lib/field-value-format.test.ts
import { describe, expect, it } from "vitest";
import { formatCountry, formatDateValue, formatFieldValue, humanizeOptionCode } from "./field-value-format";

describe("formatCountry", () => {
  it("turns upper-case ISO alpha-2 codes into English names", () => {
    expect(formatCountry("PK")).toBe("Pakistan");
  });

  it("leaves lower-case two-letter free text alone (na = N/A, not Namibia)", () => {
    expect(formatCountry("na")).toBe("na");
    expect(formatCountry("id")).toBe("id");
  });

  it("keeps names, unknown codes and blanks as-is", () => {
    expect(formatCountry("South African")).toBe("South African");
    expect(formatCountry("QQ")).toBe("QQ");
    expect(formatCountry("PAK")).toBe("PAK");
    expect(formatCountry(null)).toBe("");
  });
});

describe("formatDateValue", () => {
  it("renders a date-only value on the same calendar day", () => {
    expect(formatDateValue("2005-12-29")).toBe("29 December 2005");
    expect(formatDateValue("2005-01-01")).toBe("1 January 2005");
    expect(formatDateValue("2005-12-31")).toBe("31 December 2005");
  });

  it("renders a stored timestamp in the business timezone", () => {
    expect(formatDateValue("2005-12-29T00:00:00.000Z")).toBe("29 December 2005");
  });

  it("leaves free text and impossible dates alone", () => {
    expect(formatDateValue("29/12/2005")).toBe("29/12/2005");
    expect(formatDateValue("2005-13-45")).toBe("2005-13-45");
  });
});

describe("humanizeOptionCode", () => {
  it("title-cases lowercase snake_case codes", () => {
    expect(humanizeOptionCode("bachelors")).toBe("Bachelors");
    expect(humanizeOptionCode("high_school")).toBe("High School");
  });

  it("does not touch free text", () => {
    expect(humanizeOptionCode("my older sister")).toBe("my older sister");
    expect(humanizeOptionCode("Universitas Indonesia")).toBe("Universitas Indonesia");
    expect(humanizeOptionCode("https://x.com/a_b")).toBe("https://x.com/a_b");
  });
});

describe("formatFieldValue free text", () => {
  it("does not humanize a name-listed field the form types as text", () => {
    expect(formatFieldValue("friend", { name: "knowledge_source", type: "text" })).toBe("friend");
    expect(formatFieldValue("bachelors", { name: "education_level" })).toBe("Bachelors");
  });
});

describe("formatFieldValue", () => {
  it("prefers the form's option label", () => {
    const field = { name: "education_level", type: "select", options: [{ value: "bachelors", label: "Bachelor's degree (S1)" }] };
    expect(formatFieldValue("bachelors", field)).toBe("Bachelor's degree (S1)");
  });

  it("humanizes option codes the form has no label for", () => {
    expect(formatFieldValue("high_school", { name: "education_level" })).toBe("High School");
    expect(formatFieldValue("male", { name: "gender" })).toBe("Male");
    expect(formatFieldValue("other_option", { name: "q7", type: "radio", options: [{ value: "a", label: "A" }] })).toBe("Other Option");
  });

  it("upper-cases shirt sizes", () => {
    expect(formatFieldValue("xl", { name: "tshirt_size" })).toBe("XL");
    expect(formatFieldValue("2xl", { name: "tshirt_size" })).toBe("2XL");
  });

  it("formats country fields by type, input type or name", () => {
    expect(formatFieldValue("PK", { name: "q1", type: "country" })).toBe("Pakistan");
    expect(formatFieldValue("PK", { name: "q2", type: "select", inputType: "country_select" })).toBe("Pakistan");
    expect(formatFieldValue("PK", { name: "nationality" })).toBe("Pakistan");
    expect(formatFieldValue("JP", { name: "home_country" })).toBe("Japan");
    expect(formatFieldValue("Narnia", { name: "nationality" })).toBe("Narnia");
  });

  it("formats date fields by type or name", () => {
    expect(formatFieldValue("2005-12-29", { name: "dob", type: "date" })).toBe("29 December 2005");
    expect(formatFieldValue("2005-12-29", { name: "q", type: "date_input" })).toBe("29 December 2005");
    expect(formatFieldValue("2005-12-29", { name: "date_of_birth" })).toBe("29 December 2005");
  });

  it("returns free text unchanged and blanks as empty", () => {
    expect(formatFieldValue("PK", { name: "nickname", type: "text" })).toBe("PK");
    expect(formatFieldValue("2005-12-29", { name: "notes", type: "text" })).toBe("2005-12-29");
    expect(formatFieldValue("some_handle", { name: "instagram", type: "text" })).toBe("some_handle");
    expect(formatFieldValue("   ", { name: "gender" })).toBe("");
    expect(formatFieldValue(undefined, { name: "gender" })).toBe("");
  });
});
