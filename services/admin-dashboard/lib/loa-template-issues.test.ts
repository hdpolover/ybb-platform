// lib/loa-template-issues.test.ts
import { describe, expect, it } from "vitest";
import { getLoaTemplateIssues } from "./loa-template-issues";

const complete = {
  logoUrl: "https://cdn.example.com/logo.png",
  header: { tagline: "Together", website: "iys.com", email: "", phone: "" },
  signatureId: "sig-1",
};

describe("getLoaTemplateIssues", () => {
  it("returns nothing for a complete template", () => {
    expect(getLoaTemplateIssues(complete, { isLegacyHeader: false })).toEqual([]);
  });

  it("flags missing logo, empty letterhead details and missing signature", () => {
    const keys = getLoaTemplateIssues({ header: { tagline: " " } }, { isLegacyHeader: false }).map((i) => i.key);

    expect(keys).toEqual(["logo", "letterhead", "signature"]);
  });

  it("accepts the legacy signature image as a signature", () => {
    const issues = getLoaTemplateIssues(
      { ...complete, signatureId: undefined, signatureUrl: "https://cdn.example.com/sig.jpg" },
      { isLegacyHeader: false },
    );

    expect(issues).toEqual([]);
  });

  it("skips letterhead checks while the legacy freeform header is in use", () => {
    const keys = getLoaTemplateIssues({}, { isLegacyHeader: true }).map((i) => i.key);

    expect(keys).toEqual(["signature"]);
  });
});
