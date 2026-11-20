// services/admin-dashboard/app/programs/[programId]/settings/menu-management/page.tsx
import { redirect } from "next/navigation";

// Moved to the platform area (admins and menu rules are global); kept so old links still land somewhere.
export default function MenuManagementPage() {
  redirect("/platform/roles");
}
