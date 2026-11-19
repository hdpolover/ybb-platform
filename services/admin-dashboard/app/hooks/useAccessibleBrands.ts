// services/admin-dashboard/app/hooks/useAccessibleBrands.ts
"use client";

import { useMemo } from "react";
import { useAuth } from "@/app/contexts/AuthContext";

export type AccessibleBrand = {
  brandId: string;
  brandName: string;
  brandSlug: string;
};

/**
 * Every brand the signed-in admin may act on, mirroring what the API allows:
 * the brands behind their accessible programmes, deduped by id. A platform
 * admin's accessiblePrograms span every brand; anyone else reaches only the
 * brands of programmes they are explicitly assigned to. Brand rows
 * (`assignedBrands`) are deliberately not read: they grant nothing (owner
 * policy 2026-11-19, see resolveUsersScope in the API).
 */
export function useAccessibleBrands(): AccessibleBrand[] {
  const { adminProfile } = useAuth();

  return useMemo(() => {
    if (!adminProfile) return [];

    const byId = new Map<string, AccessibleBrand>();

    for (const program of adminProfile.accessiblePrograms ?? []) {
      if (!program.brandId || byId.has(program.brandId)) continue;
      byId.set(program.brandId, {
        brandId: program.brandId,
        brandName: program.brandName,
        brandSlug: program.brandSlug,
      });
    }

    return [...byId.values()];
  }, [adminProfile]);
}
