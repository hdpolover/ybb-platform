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
 * (`assignedBrands`) grant nothing (owner policy 2026-11-19, see
 * resolveUsersScope in the API); for platform admins only, they still order the
 * list so the /platform pages default to the brand the admin normally works in.
 */
export function useAccessibleBrands(): AccessibleBrand[] {
  const { adminProfile, accessConfig } = useAuth();

  return useMemo(() => {
    if (!adminProfile) return [];

    const byId = new Map<string, AccessibleBrand>();

    // Ordering hint only (platform admins already reach every brand).
    if (accessConfig.canAccessPlatform) {
      for (const brand of adminProfile.assignedBrands ?? []) {
        if (!brand.brandId || byId.has(brand.brandId)) continue;
        byId.set(brand.brandId, { brandId: brand.brandId, brandName: brand.brandName, brandSlug: brand.brandSlug });
      }
    }

    for (const program of adminProfile.accessiblePrograms ?? []) {
      if (!program.brandId || byId.has(program.brandId)) continue;
      byId.set(program.brandId, {
        brandId: program.brandId,
        brandName: program.brandName,
        brandSlug: program.brandSlug,
      });
    }

    return [...byId.values()];
  }, [adminProfile, accessConfig.canAccessPlatform]);
}
