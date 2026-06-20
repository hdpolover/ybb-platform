"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { AdminShell } from "@/src/admin/admin-shell";
import { ProgramSelect } from "../../components/navbar/ProgramSelect";
import { AccountMenu } from "../../components/navbar/AccountMenu";
import { programNavSections } from "@/lib/nav-config";
import { buildPermissionSet, filterProgramNavSectionsByPermissions } from "@/lib/admin-access";
import { listProgramSupportTickets } from "@/src/shared/api-client";

export default function ProgramLayout({
  params,
  children,
}: {
  params: Promise<{ programId: string }>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { programId } = use(params);
  const { adminProfile, accessiblePrograms, accessConfig, isLoading, isPlatformAdmin } = useAuth();

  const isAssignedToCurrentProgram = accessiblePrograms.some((p) => p.programId === programId);
  const hasProgramAccess =
    isPlatformAdmin || isAssignedToCurrentProgram;
  const permissionSet = useMemo(
    () => buildPermissionSet(adminProfile, programId),
    [adminProfile, programId],
  );

  const scopedProgramNavSections = useMemo(() => {
    if (accessConfig.isSuperAdmin) {
      return programNavSections;
    }

    return filterProgramNavSectionsByPermissions(programNavSections, permissionSet);
  }, [accessConfig.isSuperAdmin, permissionSet]);

  // programId from the route may be a slug; the support-ticket API needs the UUID.
  const resolvedProgramId = useMemo(() => {
    const match = accessiblePrograms.find(
      (p) => p.programId === programId || p.programSlug === programId,
    );
    return match?.programId ?? programId;
  }, [accessiblePrograms, programId]);

  // Open support ticket count for the nav badge.
  const [openTicketCount, setOpenTicketCount] = useState(0);
  useEffect(() => {
    let isMounted = true;
    if (!resolvedProgramId) return;
    listProgramSupportTickets(resolvedProgramId, { status: "open", limit: 1 })
      .then((res) => {
        if (isMounted) setOpenTicketCount(res.meta?.total ?? 0);
      })
      .catch(() => {
        // Non-critical
      });
    return () => {
      isMounted = false;
    };
  }, [resolvedProgramId]);

  const navSectionsWithBadges = useMemo(() => {
    if (!openTicketCount) return scopedProgramNavSections;
    return scopedProgramNavSections.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.id === "support-tickets" ? { ...item, badgeCount: openTicketCount } : item,
      ),
    }));
  }, [scopedProgramNavSections, openTicketCount]);

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
      navSections={navSectionsWithBadges}
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
