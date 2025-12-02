"use client";

import { use } from "react";
import { ProgramDashboard } from "../../components/dashboard/ProgramDashboard";

export default function ProgramDashboardPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  return <ProgramDashboard selectedProgramId={programId} />;
}
