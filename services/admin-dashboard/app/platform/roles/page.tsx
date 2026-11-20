// services/admin-dashboard/app/platform/roles/page.tsx
"use client";

import { MenuManagement } from "@/app/components/settings/MenuManagement";
import { RolesPermissionsSettings } from "@/app/components/settings/RolesPermissionsSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";

// Roles and menu rules are global, so they live under /platform (super admins only, gated by app/platform/layout.tsx).
export default function PlatformRolesPage() {
  return (
    <Tabs defaultValue="roles" className="space-y-4">
      <TabsList>
        <TabsTrigger value="roles">Roles &amp; permissions</TabsTrigger>
        <TabsTrigger value="menu">Menu access</TabsTrigger>
      </TabsList>
      <TabsContent value="roles" className="mt-0">
        <RolesPermissionsSettings />
      </TabsContent>
      <TabsContent value="menu" className="mt-0">
        <MenuManagement />
      </TabsContent>
    </Tabs>
  );
}
