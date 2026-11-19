// services/admin-dashboard/lib/admin-access.test.ts
import { describe, expect, it } from "vitest";
import { hasRequiredPermissions, programWritePermissions } from "./admin-access";

// Prod role permission sets (admin_roles, 2026-11-19). The API enforces the
// same programWritePermissions; this pins which controls each role is offered.
const ROLES: Record<string, string[]> = {
  newsWriter: ["program:read", "content:read", "content:write", "announcements:read", "announcements:write", "media:read", "media:write", "documents:read"],
  digitalMarketing: ["participants:read", "participants:write", "support:write", "support:read", "payments:read", "announcements:read", "media:write"],
  reviewer: ["program:read", "applications:read", "applications:write", "review:read", "review:write", "documents:read"],
  programAdmin: ["program:read", "program:write", "applications:read", "applications:write", "participants:read", "participants:write", "payments:read", "documents:read", "announcements:read", "media:read"],
};

const can = (role: string, action: keyof typeof programWritePermissions) =>
  hasRequiredPermissions(new Set(ROLES[role]), programWritePermissions[action]);

describe("programWritePermissions against prod roles", () => {
  it.each([
    ["newsWriter", "announcements", true],
    ["digitalMarketing", "announcements", false],
    ["programAdmin", "announcements", true],
    ["digitalMarketing", "payments", false],
    ["programAdmin", "payments", false],
    ["digitalMarketing", "resendReceipt", true],
    ["digitalMarketing", "applicationEdit", false],
    ["reviewer", "applicationEdit", true],
    ["programAdmin", "applicationSubmit", true],
    ["digitalMarketing", "applicationSubmit", false],
    ["newsWriter", "content", true],
    ["newsWriter", "media", true],
    ["newsWriter", "gallery", true],
    ["newsWriter", "documents", true],
    ["newsWriter", "programConfig", false],
    ["newsWriter", "ambassadors", false],
    ["newsWriter", "reminders", false],
    ["digitalMarketing", "media", true],
    ["digitalMarketing", "gallery", true],
    ["digitalMarketing", "content", false],
    ["digitalMarketing", "documents", false],
    ["digitalMarketing", "ambassadors", true],
    ["digitalMarketing", "reminders", true],
    ["digitalMarketing", "paymentHelp", true],
    ["digitalMarketing", "programPaymentConfig", false],
    ["digitalMarketing", "fundingDecision", false],
    ["reviewer", "fundingDecision", true],
    ["reviewer", "submissionForm", true],
    ["reviewer", "content", false],
    ["reviewer", "media", false],
    ["reviewer", "paymentHelp", false],
    ["reviewer", "reminders", false],
    ["programAdmin", "programConfig", true],
    ["programAdmin", "content", true],
    ["programAdmin", "pricing", true],
    ["programAdmin", "partners", true],
    ["programAdmin", "programPaymentConfig", true],
    ["programAdmin", "fundingDecision", true],
    ["programAdmin", "ambassadors", true],
    ["programAdmin", "reminders", true],
    ["programAdmin", "paymentHelp", false],
  ] as const)("%s may %s: %s", (role, action, expected) => {
    expect(can(role, action)).toBe(expected);
  });

  it("grant-all permissions pass every write", () => {
    for (const anyOf of Object.values(programWritePermissions)) {
      expect(hasRequiredPermissions(new Set(["platform.manage"]), anyOf)).toBe(true);
    }
  });
});
