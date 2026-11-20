// services/admin-dashboard/lib/admin-access.test.ts
import { describe, expect, it } from "vitest";
import {
  getRequiredPermissionsForMenuItem,
  hasRequiredPermissions,
  programWritePermissions,
} from "./admin-access";

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
    // LOA documents are official documents: a News Writer no longer releases or signs them.
    ["newsWriter", "documents", false],
    ["programAdmin", "documents", true],
    ["digitalMarketing", "support", true],
    ["newsWriter", "support", false],
    ["reviewer", "support", false],
    ["programAdmin", "support", false],
    ["programAdmin", "resendReceipt", true],
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
    // The submission form is program configuration: reviewers work submissions, not the form.
    ["reviewer", "submissionForm", false],
    ["programAdmin", "submissionForm", true],
    ["newsWriter", "submissionForm", false],
    ["newsWriter", "partners", true],
    ["reviewer", "partners", false],
    ["digitalMarketing", "partners", false],
    ["reviewer", "documents", false],
    ["digitalMarketing", "pricing", false],
    ["reviewer", "pricing", false],
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
    ["programAdmin", "paymentHelp", true],
    // Payments export is read-level (reporting.controller.ts); news writers have no payments permission.
    ["digitalMarketing", "paymentsExport", true],
    ["programAdmin", "paymentsExport", true],
    ["reviewer", "paymentsExport", false],
    ["newsWriter", "paymentsExport", false],
    // Score save, document review, category switch: review:write or applications:write.
    ["reviewer", "review", true],
    ["programAdmin", "review", true],
    ["digitalMarketing", "review", false],
    ["newsWriter", "review", false],
  ] as const)("%s may %s: %s", (role, action, expected) => {
    expect(can(role, action)).toBe(expected);
  });

  it("grant-all permissions pass every write", () => {
    for (const anyOf of Object.values(programWritePermissions)) {
      expect(hasRequiredPermissions(new Set(["platform.manage"]), anyOf)).toBe(true);
    }
  });
});

describe("menu rules against prod roles", () => {
  const sees = (role: string, menuId: string) =>
    hasRequiredPermissions(new Set(ROLES[role]), getRequiredPermissionsForMenuItem(menuId));

  it.each([
    // Revenue shows gross/fee/net: payments:read or payments:write, not program:write alone.
    ["digitalMarketing", "revenue", true],
    ["reviewer", "revenue", false],
    ["newsWriter", "revenue", false],
    // Reminders: the API needs participants:write or program:write, so announcements/payments writers do not see it.
    ["digitalMarketing", "reminders", true],
    ["programAdmin", "reminders", true],
    ["newsWriter", "reminders", false],
    ["reviewer", "reminders", false],
  ] as const)("%s sees %s: %s", (role, menuId, expected) => {
    expect(sees(role, menuId)).toBe(expected);
  });

  it("an announcements-only or payments-write-only admin no longer sees reminders", () => {
    for (const permission of ["announcements:write", "payments:write"]) {
      expect(hasRequiredPermissions(new Set([permission]), getRequiredPermissionsForMenuItem("reminders"))).toBe(false);
    }
  });
});
