// services/admin-dashboard/app/platform/audit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/src/admin/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { listAdmins } from "@/src/shared/api-client";
import type { AdminOption } from "@/lib/audit-log";
import { AdminActivityTab } from "./_components/AdminActivityTab";
import { AdminLoginsTab } from "./_components/AdminLoginsTab";

const ADMIN_LIST_LIMIT = 100;

// Access is gated by app/platform/layout.tsx (platform admins only); the API enforces it again.
export default function AuditLogPage() {
  const [admins, setAdmins] = useState<AdminOption[]>([]);

  useEffect(() => {
    listAdmins({ page: 1, limit: ADMIN_LIST_LIMIT })
      .then((res) =>
        setAdmins(
          res.data
            .map((a) => ({ id: a.id, name: a.fullName, email: a.user.email }))
            .sort((x, y) => x.name.localeCompare(y.name)),
        ),
      )
      // Without names the tables still work; actors show as "Unknown admin <id>".
      .catch(() => setAdmins([]));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" description="Who changed what, and when admins signed in." />
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Admin activity</TabsTrigger>
          <TabsTrigger value="logins">Admin logins</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-0">
          <AdminActivityTab admins={admins} />
        </TabsContent>
        <TabsContent value="logins" className="mt-0">
          <AdminLoginsTab admins={admins} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
