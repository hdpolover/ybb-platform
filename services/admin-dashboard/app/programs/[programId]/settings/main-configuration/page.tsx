"use client";

import { use } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { MainConfigurationSettings } from "@/app/components/settings/MainConfigurationSettings";

export default function MainConfigurationPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms } = useAuth();
  const programName =
    accessiblePrograms.find((program) => program.programId === programId)?.programName ??
    "Selected Program";

  return <MainConfigurationSettings programId={programId} programName={programName} />;
}
