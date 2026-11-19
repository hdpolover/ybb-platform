// services/admin-dashboard/app/set-password/page.tsx
import type { Metadata } from "next";
import SetPasswordForm from "./SetPasswordForm";

export const metadata: Metadata = { title: "Set password - YBB Admin" };

type SetPasswordPageProps = { searchParams: Promise<{ token?: string }> };

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const { token } = await searchParams;
  return <SetPasswordForm token={token ?? null} />;
}
