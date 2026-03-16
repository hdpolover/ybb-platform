"use client";

import { use } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { RolesPermissionsSettings } from "@/app/components/settings/RolesPermissionsSettings";

export default function RolesPermissionsSettingsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms } = useAuth();
  const programName =
    accessiblePrograms.find((program) => program.programId === programId)?.programName ??
    "Selected Program";

  return <RolesPermissionsSettings programName={programName} />;
}
