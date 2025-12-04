"use client";

import { use } from "react";
import { ProgramDocumentsHeader } from "@/app/components/documents/ProgramDocumentsHeader";
import { ProgramDocumentsTable } from "@/app/components/documents/ProgramDocumentsTable";

export default function ProgramDocumentsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div className="space-y-4">
      <ProgramDocumentsHeader />
      <ProgramDocumentsTable />
    </div>
  );
}
