// services/admin-dashboard/src/shared/login-redirect.test.ts
import { describe, expect, it } from "vitest";
import { isPublicPath } from "./login-redirect";

describe("isPublicPath", () => {
  it("covers the pages that must work without a session", () => {
    expect(isPublicPath("/request-access")).toBe(true);
    expect(isPublicPath("/set-password")).toBe(true);
    expect(isPublicPath("/set-password/")).toBe(true);
  });

  it("does not match lookalikes or protected pages", () => {
    expect(isPublicPath("/set-password-evil")).toBe(false);
    expect(isPublicPath("/platform/admins")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});
