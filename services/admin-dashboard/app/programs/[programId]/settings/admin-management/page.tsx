"use client";

import { use } from "react";
import { programs } from "@/app/components/navbar/ProgramSelect";
import { AdminManagement } from "@/app/components/settings/AdminManagement";

function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const program = programs.find((item) => item.id === programId);
  return program?.name ?? "Selected Program";
}

export default function AdminManagementPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const programName = getProgramName(programId);
  const allPrograms = programs.map((program) => program.name);

  return <AdminManagement programName={programName} allPrograms={allPrograms} />;
}
