"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { AdminShell } from "@/src/admin/admin-shell";
import { AccountMenu } from "../components/navbar/AccountMenu";
import { platformNavSections } from "@/lib/nav-config";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { adminProfile, isLoading, isPlatformAdmin } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!adminProfile) { router.replace("/login"); return; }
    if (!isPlatformAdmin) router.replace("/");
  }, [adminProfile, isLoading, isPlatformAdmin, router]);

  if (isLoading || !adminProfile || !isPlatformAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <AdminShell
      navSections={platformNavSections}
      context="platform"
      homeHref="/platform"
      userMenu={<AccountMenu />}
    >
      {children}
    </AdminShell>
  );
}
