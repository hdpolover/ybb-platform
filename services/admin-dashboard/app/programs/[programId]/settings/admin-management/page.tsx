// services/admin-dashboard/app/programs/[programId]/settings/admin-management/page.tsx
import { redirect } from "next/navigation";

// Moved to the platform area (admins and menu rules are global); kept so old links still land somewhere.
export default function AdminManagementPage() {
  redirect("/platform/admins");
}
