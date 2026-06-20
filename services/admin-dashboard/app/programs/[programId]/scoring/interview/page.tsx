"use client";

import { use, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { exportApplicationsCsv } from "@/src/shared/api-client";
import { InterviewParticipantsHeader } from "@/app/components/scoring/InterviewParticipantsHeader";
import { InterviewParticipantsTable } from "@/app/components/scoring/InterviewParticipantsTable";

export default function InterviewScoringPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useResolvedProgramId(programId);
  const resolvedBrandId = useMemo(
    () =>
      accessiblePrograms.find(
        (p) => p.programId === resolvedProgramId || p.programSlug === programId,
      )?.brandId ?? "",
    [accessiblePrograms, resolvedProgramId, programId],
  );

  const [searchValue, setSearchValue] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportApplicationsCsv({
        brandId: resolvedBrandId,
        programId: resolvedProgramId,
        status: "interview_scheduled",
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Interview Participants</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage interview participants and scoring for this program
        </p>
        {exportError && (
          <p className="mt-2 text-xs text-red-600">{exportError}</p>
        )}
      </div>

      <div className="space-y-4">
        <InterviewParticipantsHeader onSearch={handleSearch} />
        <InterviewParticipantsTable
          programId={resolvedProgramId}
          search={searchValue}
          resolvedBrandId={resolvedBrandId}
          onExport={handleExport}
          exporting={exporting}
        />
      </div>
    </div>
  );
}
