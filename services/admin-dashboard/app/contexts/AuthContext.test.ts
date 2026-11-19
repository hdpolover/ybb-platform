// services/admin-dashboard/app/contexts/AuthContext.test.ts
import { describe, expect, it } from "vitest";
import { computeAccessConfig, type AdminProfile } from "./AuthContext";

const profile = (overrides: Partial<AdminProfile>): AdminProfile =>
  ({
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    roleName: "Program Admin",
    permissions: ["program:read"],
    customPermissions: [],
    assignedPrograms: [],
    accessiblePrograms: [],
    assignedBrands: [],
    ...overrides,
  }) as unknown as AdminProfile;

const programRow = (permissions: string[]) => ({ programId: "p1", permissions }) as AdminProfile["assignedPrograms"][number];

describe("computeAccessConfig platform status", () => {
  it.each(["platform_access", "platform.manage", "admin.manage", "*"])(
    "a program row carrying %s does not make the admin platform",
    (permission) => {
      const config = computeAccessConfig(profile({ assignedPrograms: [programRow([permission])] }));
      expect(config.canAccessPlatform).toBe(false);
      expect(config.isSuperAdmin).toBe(false);
    },
  );

  it("a role with platform_access is still platform", () => {
    const config = computeAccessConfig(profile({ permissions: ["platform_access"], assignedPrograms: [programRow([])] }));
    expect(config.canAccessPlatform).toBe(true);
  });
});
