// services/admin-dashboard/lib/profile-summary.test.ts
import { describe, expect, it } from "vitest";
import { buildProfileSummary, stripQuery, type ProfileSummaryFields } from "./profile-summary";

const full: ProfileSummaryFields = {
  name: "Aisha Khan",
  email: "aisha@example.com",
  phone: "+923347354006",
  program: "WYF 2026",
  category: "Fully Funded",
  applicationStatus: "Submitted",
  registrationFee: "Paid",
  programFee: "Unpaid",
  nationality: "Pakistan",
  institution: "LUMS",
  major: "Economics",
};

describe("buildProfileSummary", () => {
  it("emits one Label: value line per field in order, then the admin link", () => {
    expect(buildProfileSummary(full, "https://admin.test/programs/1/participants/2")).toBe(
      [
        "Name: Aisha Khan",
        "Email: aisha@example.com",
        "Phone: +923347354006",
        "Program: WYF 2026",
        "Category: Fully Funded",
        "Application status: Submitted",
        "Registration fee: Paid",
        "Program fee: Unpaid",
        "Nationality: Pakistan",
        "Institution: LUMS",
        "Major: Economics",
        "Admin link: https://admin.test/programs/1/participants/2",
      ].join("\n"),
    );
  });

  it("skips empty and placeholder values", () => {
    const text = buildProfileSummary({ ...full, phone: "—", major: "  ", institution: "-", programFee: "" }, "");
    expect(text).not.toMatch(/Phone|Major|Institution|Program fee|Admin link/);
    expect(text.split("\n")).toHaveLength(7);
  });

  it("drops the query string and hash from the admin link", () => {
    expect(stripQuery("https://a.test/p/1?tab=essays#x")).toBe("https://a.test/p/1");
    expect(buildProfileSummary(full, "https://a.test/p/1?tab=essays")).toMatch(/Admin link: https:\/\/a\.test\/p\/1$/);
  });
});
