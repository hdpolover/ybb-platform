"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { AdminShell } from "@/src/admin/admin-shell";
import { AccountMenu } from "../components/navbar/AccountMenu";
import { platformNavSections } from "@/lib/nav-config";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { adminProfile, isLoading, isPlatformAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Mount flag: empty deps, runs exactly once, can't loop.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (!adminProfile) { router.replace("/login"); return; }
    if (!isPlatformAdmin) router.replace("/");
  }, [mounted, adminProfile, isLoading, isPlatformAdmin, router]);

  if (!mounted || isLoading || !adminProfile || !isPlatformAdmin) {
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
      homeHref="/"
      userMenu={<AccountMenu />}
    >
      {children}
    </AdminShell>
  );
}
