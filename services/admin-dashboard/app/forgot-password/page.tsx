// services/admin-dashboard/app/forgot-password/page.tsx
import type { Metadata } from "next";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password - YBB Admin" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
