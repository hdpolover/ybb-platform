"use client";

import { use } from "react";
import { programs } from "@/app/components/navbar/ProgramSelect";
import { MainConfigurationSettings } from "@/app/components/settings/MainConfigurationSettings";

function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";
  const program = programs.find((item) => item.id === programId);
  return program?.name ?? "Selected Program";
}

export default function MainConfigurationPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const programName = getProgramName(programId);

  return <MainConfigurationSettings programName={programName} />;
}
