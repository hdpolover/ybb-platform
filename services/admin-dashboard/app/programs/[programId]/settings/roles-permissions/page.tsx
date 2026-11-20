// services/admin-dashboard/app/programs/[programId]/settings/roles-permissions/page.tsx
import { redirect } from "next/navigation";

// Roles are global; the page moved to /platform/roles. Kept so old links still land somewhere.
export default function RolesPermissionsSettingsPage() {
  redirect("/platform/roles");
}
