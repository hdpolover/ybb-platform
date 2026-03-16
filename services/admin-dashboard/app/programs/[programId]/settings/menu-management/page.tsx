"use client";

import { use } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { MenuManagement } from "@/app/components/settings/MenuManagement";

export default function MenuManagementPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms } = useAuth();
  const programName =
    accessiblePrograms.find((program) => program.programId === programId)?.programName ??
    "Selected Program";

  return <MenuManagement programName={programName} />;
}
