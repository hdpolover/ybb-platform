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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // The route param may be a slug, but the support-ticket API needs the program
  // UUID and returns 500 on a slug. Resolve it from accessiblePrograms, and only
  // use a value we know is a UUID (resolved match, or a route param that already
  // is one). This avoids the badge fetch firing with the slug before
  // accessiblePrograms has loaded.
  const ticketProgramId = useMemo(() => {
    const match = accessiblePrograms.find(
      (p) => p.programId === programId || p.programSlug === programId,
    );
    if (match?.programId) return match.programId;
    return UUID_PATTERN.test(programId) ? programId : null;
  }, [accessiblePrograms, programId]);

  // Open support ticket count for the nav badge.
  const [openTicketCount, setOpenTicketCount] = useState(0);
  useEffect(() => {
    if (!ticketProgramId) return;
    let isMounted = true;
    listProgramSupportTickets(ticketProgramId, { status: "open", limit: 1 })
      .then((res) => {
        if (isMounted) setOpenTicketCount(res.meta?.total ?? 0);
      })
      .catch(() => {
        // Non-critical
      });
    return () => {
      isMounted = false;
    };
  }, [ticketProgramId]);

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
