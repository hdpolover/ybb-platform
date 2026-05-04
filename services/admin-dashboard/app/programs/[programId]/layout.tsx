"use client";

import { use, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { AdminShell } from "@/src/admin/admin-shell";
import { ProgramSelect } from "../../components/navbar/ProgramSelect";
import { AccountMenu } from "../../components/navbar/AccountMenu";
import { programNavSections } from "@/lib/nav-config";

export default function ProgramLayout({
  params,
  children,
}: {
  params: Promise<{ programId: string }>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { programId } = use(params);
  const { adminProfile, assignedPrograms, isLoading, isPlatformAdmin } = useAuth();

  const hasProgramAccess =
    isPlatformAdmin || assignedPrograms.some((p) => p.programId === programId);

  const scopedProgramNavSections = useMemo(() => {
    if (!isPlatformAdmin) return programNavSections;
    return programNavSections.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.id !== "support-tickets"),
    }));
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (isLoading) return;
    if (!adminProfile) { router.replace("/login"); return; }
    if (!hasProgramAccess) router.replace("/");
  }, [adminProfile, hasProgramAccess, isLoading, router]);

  if (isLoading || !adminProfile || !hasProgramAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <AdminShell
      navSections={scopedProgramNavSections}
      hrefBase={`/programs/${programId}`}
      context="program"
      homeHref="/"
      contextControls={
        <ProgramSelect
          selectedProgramId={programId}
          onChangeSelectedProgram={(id) => id && router.push(`/programs/${id}`)}
          onResetSelectedProgram={() => router.push("/")}
        />
      }
      userMenu={<AccountMenu />}
    >
      {children}
    </AdminShell>
  );
}
