"use client";

import { use } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { AdminManagement } from "@/app/components/settings/AdminManagement";

export default function AdminManagementPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms } = useAuth();
  const programName =
    accessiblePrograms.find((program) => program.programId === programId)?.programName ??
    "Selected Program";
  const allPrograms = Array.from(new Set(accessiblePrograms.map((program) => program.programName)));

  return <AdminManagement programId={programId} programName={programName} allPrograms={allPrograms} />;
}
