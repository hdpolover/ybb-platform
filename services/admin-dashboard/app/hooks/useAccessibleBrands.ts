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
 * Every brand the signed-in admin may act on, mirroring what the API allows.
 *
 * The platform pages each did `assignedBrands?.[0]?.brandId`, which has two
 * problems. An admin assigned to several brands was silently confined to
 * whichever came back first, with no way to reach the others -- before the
 * users routes were scoped, an unset brandId meant "no filter" and they saw
 * everything, so closing that hole turned a leak into a capability loss. And a
 * PROGRAM-scoped admin has no `admin_brands` rows at all, so `assignedBrands`
 * is empty and `[0]` is undefined; the API now derives their brands from the
 * brands of their assigned programmes (see resolveUsersBrandFilter), and this
 * derives the same set client-side so the picker can actually offer them.
 *
 * Union of brand-level grants and the brands behind accessible programmes,
 * deduped by id. Ordered with brand grants first, since a brand-level
 * assignment is the stronger signal of where an admin normally works.
 */
export function useAccessibleBrands(): AccessibleBrand[] {
  const { adminProfile } = useAuth();

  return useMemo(() => {
    if (!adminProfile) return [];

    const byId = new Map<string, AccessibleBrand>();

    for (const brand of adminProfile.assignedBrands ?? []) {
      if (!brand.brandId) continue;
      byId.set(brand.brandId, {
        brandId: brand.brandId,
        brandName: brand.brandName,
        brandSlug: brand.brandSlug,
      });
    }

    // Programme grants imply their brand. A platform admin's accessiblePrograms
    // can span every brand, which is correct -- they are allowed all of them.
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
