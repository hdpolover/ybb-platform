"use client";

import { use } from "react";
import { programs } from "@/app/components/navbar/ProgramSelect";
import { RolesPermissionsSettings } from "@/app/components/settings/RolesPermissionsSettings";

function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const program = programs.find((item) => item.id === programId);
  return program?.name ?? "Selected Program";
}

export default function RolesPermissionsSettingsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const programName = getProgramName(programId);

  return <RolesPermissionsSettings programName={programName} />;
}
