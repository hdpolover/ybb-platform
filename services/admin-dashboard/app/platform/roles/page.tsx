// services/admin-dashboard/app/platform/roles/page.tsx
"use client";

import { RolesPermissionsSettings } from "@/app/components/settings/RolesPermissionsSettings";

// Roles are global, so they live under /platform (super admins only, gated by app/platform/layout.tsx).
export default function PlatformRolesPage() {
  return <RolesPermissionsSettings />;
}
