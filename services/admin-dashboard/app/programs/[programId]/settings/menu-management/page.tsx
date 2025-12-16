"use client";

import { use } from "react";
import { programs } from "@/app/components/navbar/ProgramSelect";
import { MenuManagement } from "@/app/components/settings/MenuManagement";

function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const program = programs.find((item) => item.id === programId);
  return program?.name ?? "Selected Program";
}

export default function MenuManagementPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const programName = getProgramName(programId);

  return <MenuManagement programName={programName} />;
}
