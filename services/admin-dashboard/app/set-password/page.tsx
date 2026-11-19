// services/admin-dashboard/app/set-password/page.tsx
import type { Metadata } from "next";
import SetPasswordForm from "./SetPasswordForm";

export const metadata: Metadata = { title: "Set password - YBB Admin" };

// The token is read client-side on purpose: reading searchParams here would put it in server access logs and the RSC payload.
export default function SetPasswordPage() {
  return <SetPasswordForm />;
}
