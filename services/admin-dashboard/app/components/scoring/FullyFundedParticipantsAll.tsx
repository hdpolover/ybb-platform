"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { listApplications, exportApplicationsCsv, type Application } from "@/src/shared/api-client";
import { FullyFundedParticipantsFilters } from "./FullyFundedParticipantsFilters";
import { FullyFundedParticipantsTable, type FullyFundedParticipantRow } from "./FullyFundedParticipantsTable";
import { EmptyState } from "@/src/admin/empty-state";
import { formatDate } from "@/lib/utils";

interface FullyFundedParticipantsAllProps {
  programId: string;
}

export function FullyFundedParticipantsAll({ programId }: FullyFundedParticipantsAllProps) {
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useResolvedProgramId(programId);
  const resolvedBrandId = useMemo(
    () =>
      accessiblePrograms.find(
        (p) => p.programId === resolvedProgramId || p.programSlug === programId,
      )?.brandId ?? "",
    [accessiblePrograms, resolvedProgramId, programId],
  );

  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listApplications({
        programId: resolvedProgramId,
        category: "fully_funded",
        search: search || undefined,
      });
      setItems(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load participants");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportApplicationsCsv({
        brandId: resolvedBrandId,
        programId: resolvedProgramId,
        category: "fully_funded",
        search: search || undefined,
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const rows: FullyFundedParticipantRow[] = items.map((app, index) => ({
    id: index + 1,
    accountId: app.id,
    name: app.participant?.fullName ?? "Unknown",
    email: app.participant?.email ?? "",
    participantId: app.participantId,
    nationality:
      app.participant?.nationality ?? app.participant?.originCountry ?? "",
    formStatus: mapFormStatus(app.status),
    registeredOn: formatDate(app.createdAt),
  }));

  if (loading) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
          Loading participants...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="py-8 text-center text-sm text-red-600">{error}</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <FullyFundedParticipantsFilters
        onSearch={(value) => setSearch(value)}
        onExport={handleExport}
        exporting={exporting}
      />
      {exportError && <p className="mb-3 text-xs text-red-600">{exportError}</p>}
      <div className="my-5 border-t border-zinc-100" />
      {rows.length === 0 ? (
        <EmptyState
          title="No fully funded participants"
          description="No participants with fully funded applications were found for this program."
        />
      ) : (
        <FullyFundedParticipantsTable data={rows} />
      )}
    </section>
  );
}

function mapFormStatus(status: string): FullyFundedParticipantRow["formStatus"] {
  if (
    status === "submitted" ||
    status === "under_review" ||
    status === "accepted" ||
    status === "rejected" ||
    status === "interview_scheduled"
  ) {
    return "Submitted";
  }
  if (status === "draft") {
    return "Not Started";
  }
  return "On Progress";
}
