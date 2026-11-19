// services/admin-dashboard/app/hooks/useProgramWriteAccess.ts
"use client";

import { useMemo } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { buildPermissionSet, hasRequiredPermissions } from "@/lib/admin-access";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";

/**
 * Whether the admin may perform a write that needs one of `anyOf` in this
 * program. Platform-tier admins always may: the API's assertProgramPermission
 * lets the same tier (canAccessPlatform here) through every permission check.
 * `programId` may be the route's slug.
 */
export function useProgramWriteAccess(programId: string, anyOf: readonly string[]): boolean {
  const { adminProfile, accessConfig } = useAuth();
  const resolvedProgramId = useResolvedProgramId(programId);
  return useMemo(
    () =>
      accessConfig.canAccessPlatform ||
      hasRequiredPermissions(buildPermissionSet(adminProfile, resolvedProgramId), anyOf),
    [accessConfig.canAccessPlatform, adminProfile, resolvedProgramId, anyOf],
  );
}
