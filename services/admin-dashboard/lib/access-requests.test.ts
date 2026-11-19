// services/admin-dashboard/lib/access-requests.test.ts
import { describe, expect, it } from "vitest";
import {
  canSendPasswordLink,
  groupProgramsByBrand,
  isPlatformTierRole,
  validateAccessRequest,
  validateNewPassword,
} from "./access-requests";

const valid = { fullName: "Dewi Lestari", email: "dewi@example.com", division: "ops", programIds: [], note: "" };

describe("validateAccessRequest", () => {
  it("accepts a minimal valid draft", () => {
    expect(validateAccessRequest(valid)).toEqual({});
  });

  it.each([
    [{ fullName: "A" }, "fullName"],
    [{ fullName: "x".repeat(101) }, "fullName"],
    [{ email: "not-an-email" }, "email"],
    [{ division: "" }, "division"],
    [{ programIds: Array.from({ length: 31 }, (_, i) => `p${i}`) }, "programIds"],
    [{ note: "n".repeat(1001) }, "note"],
  ])("rejects %j", (override, field) => {
    expect(validateAccessRequest({ ...valid, ...override })).toHaveProperty(field);
  });

  it("allows exactly 30 programs and a 1000-char note", () => {
    const draft = { ...valid, programIds: Array.from({ length: 30 }, (_, i) => `p${i}`), note: "n".repeat(1000) };
    expect(validateAccessRequest(draft)).toEqual({});
  });
});

describe("validateNewPassword", () => {
  it("mirrors the reset-password DTO rules", () => {
    expect(validateNewPassword("Short1", "Short1")).toMatch(/at least 8/);
    expect(validateNewPassword("alllowercase1", "alllowercase1")).toMatch(/uppercase/);
    expect(validateNewPassword("ALLUPPER1234", "ALLUPPER1234")).toMatch(/lowercase/);
    expect(validateNewPassword("NoDigitsHere", "NoDigitsHere")).toMatch(/number or special/);
    expect(validateNewPassword("Valid-pass", "Valid-pass")).toBeNull();
  });

  it("requires the confirmation to match", () => {
    expect(validateNewPassword("Valid1234", "Valid12345")).toMatch(/do not match/);
  });
});

describe("groupProgramsByBrand", () => {
  it("groups by brand and sorts both levels", () => {
    const groups = groupProgramsByBrand([
      { id: "1", name: "B Program", brandName: "Zed" },
      { id: "2", name: "A Program", brandName: "Zed" },
      { id: "3", name: "C Program", brandName: "Alpha" },
    ]);
    expect(groups.map((g) => g.brandName)).toEqual(["Alpha", "Zed"]);
    expect(groups[1].programs.map((p) => p.name)).toEqual(["A Program", "B Program"]);
  });
});

describe("isPlatformTierRole", () => {
  it.each([
    [{ name: "Super Admin", permissions: [] }, true],
    [{ name: "Ops", permissions: ["admin.manage"] }, true],
    [{ name: "Ops", permissions: ["platform_access"] }, true],
    [{ name: "Ops", permissions: ["*"] }, true],
    [{ name: "Reviewer", permissions: ["review:read", "program:read"] }, false],
  ])("%j -> %s", (role, expected) => {
    expect(isPlatformTierRole(role)).toBe(expected);
  });
});

describe("canSendPasswordLink", () => {
  it("needs canManageAdmins", () => {
    expect(canSendPasswordLink({ canManageAdmins: false }, "me", "other")).toBe(false);
    expect(canSendPasswordLink({ canManageAdmins: true }, "me", "other")).toBe(true);
  });

  it("is hidden on the actor's own row", () => {
    expect(canSendPasswordLink({ canManageAdmins: true }, "me", "me")).toBe(false);
  });
});
