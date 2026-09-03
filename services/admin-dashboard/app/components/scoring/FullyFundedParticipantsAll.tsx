"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { listApplications, exportApplicationsExcel, submitApplication, type Application } from "@/src/shared/api-client";
import {
  FullyFundedParticipantsFilters,
  MIN_PAGE_SIZE,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  type FullyFundedSortBy,
  type FullyFundedSortOrder,
  type FullyFundedStatusFilter,
  type FullyFundedScoreStatusFilter,
  type FullyFundedRegistrationPaymentStatusFilter,
} from "./FullyFundedParticipantsFilters";
import { fullyFundedFilterParsers } from "./fullyFundedFilterParsers";
import { FullyFundedParticipantsTable, type FullyFundedParticipantRow } from "./FullyFundedParticipantsTable";
import { EmptyState } from "@/src/admin/empty-state";
import { formatDate } from "@/lib/utils";

interface FullyFundedParticipantsAllProps {
  programId: string;
  /** Which application category this queue lists — reused for both the
   *  fully-funded reviewer queue and the self-funded spot-check tab. */
  category: "fully_funded" | "self_funded";
}

/** Clamps a URL-sourced page size to [MIN_PAGE_SIZE, MAX_PAGE_SIZE] — a user can hand-edit the query string. */
function clampPageSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.floor(value), MIN_PAGE_SIZE), MAX_PAGE_SIZE);
}

export function FullyFundedParticipantsAll({ programId, category }: FullyFundedParticipantsAllProps) {
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useResolvedProgramId(programId);
  const resolvedBrandId = useMemo(
    () =>
      accessiblePrograms.find(
        (p) => p.programId === resolvedProgramId || p.programSlug === programId,
      )?.brandId ?? "",
    [accessiblePrograms, resolvedProgramId, programId],
  );

  const [filters, setFilters] = useQueryStates(fullyFundedFilterParsers);
  const { search, status, scoreStatus, registrationPaymentStatus, sortBy, sortOrder, page } = filters;
  const pageSize = clampPageSize(filters.pageSize);

  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listApplications({
        programId: resolvedProgramId,
        category,
        status: status === "all" ? undefined : status,
        scoreStatus: scoreStatus === "all" ? undefined : scoreStatus,
        registrationPaymentStatus: registrationPaymentStatus === "all" ? undefined : registrationPaymentStatus,
        search: search || undefined,
        sortBy,
        sortOrder,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setItems(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load participants");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId, category, search, status, scoreStatus, registrationPaymentStatus, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Don't strand the admin on a page that no longer exists (e.g. a filter
  // change shrank the result set below the current page).
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) {
      void setFilters({ page: totalPages });
    }
  }, [page, pageSize, total, setFilters]);

  const handleSearch = useCallback(
    (value: string) => void setFilters({ search: value || null, page: 1 }),
    [setFilters],
  );
  const handleStatusChange = useCallback(
    (value: FullyFundedStatusFilter) => void setFilters({ status: value, page: 1 }),
    [setFilters],
  );
  const handleScoreStatusChange = useCallback(
    (value: FullyFundedScoreStatusFilter) => void setFilters({ scoreStatus: value, page: 1 }),
    [setFilters],
  );
  const handleRegistrationPaymentStatusChange = useCallback(
    (value: FullyFundedRegistrationPaymentStatusFilter) =>
      void setFilters({ registrationPaymentStatus: value, page: 1 }),
    [setFilters],
  );
  const handleSortByChange = useCallback(
    (value: FullyFundedSortBy) => void setFilters({ sortBy: value, page: 1 }),
    [setFilters],
  );
  const handleSortOrderChange = useCallback(
    (value: FullyFundedSortOrder) => void setFilters({ sortOrder: value, page: 1 }),
    [setFilters],
  );
  const handlePageSizeChange = useCallback(
    (value: number) => void setFilters({ pageSize: clampPageSize(value), page: 1 }),
    [setFilters],
  );
  const handlePageChange = useCallback(
    (value: number) => void setFilters({ page: value }),
    [setFilters],
  );

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportApplicationsExcel({
        brandId: resolvedBrandId,
        programId: resolvedProgramId,
        category,
        status: status === "all" ? undefined : status,
        scoreStatus: scoreStatus === "all" ? undefined : scoreStatus,
        registrationPaymentStatus: registrationPaymentStatus === "all" ? undefined : registrationPaymentStatus,
        search: search || undefined,
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Force-submit on the participant's behalf once the deadline has passed —
  // submit is only an edit-lock and must not block scoring eligibility.
  // Gated in the table to draft + paid applications only.
  const handleForceSubmit = useCallback(
    async (row: FullyFundedParticipantRow) => {
      setSubmittingId(row.accountId);
      try {
        await submitApplication(row.accountId, row.participantId);
        toast.success("Application submitted successfully.");
        await fetchData();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to submit application.");
      } finally {
        setSubmittingId(null);
      }
    },
    [fetchData],
  );

  const rows: FullyFundedParticipantRow[] = items.map((app, index) => ({
    id: index + 1,
    accountId: app.id,
    name: app.participant?.fullName ?? "Unknown",
    email: app.participant?.email ?? "",
    participantId: app.participantId,
    nationality:
      app.participant?.nationality ?? app.participant?.originCountry ?? "",
    formStatus: mapFormStatus(app.status),
    status: app.status,
    registrationPaymentStatus: app.registrationPaymentStatus,
    registeredOn: formatDate(app.createdAt),
    essayFilled: app.essayFilled,
    scoreTotal: app.scoreTotal,
    scoreStatus: app.scoreStatus,
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
        initialSearch={search}
        onSearch={handleSearch}
        onExport={handleExport}
        exporting={exporting}
        status={status}
        onStatusChange={handleStatusChange}
        scoreStatus={scoreStatus}
        onScoreStatusChange={handleScoreStatusChange}
        registrationPaymentStatus={registrationPaymentStatus}
        onRegistrationPaymentStatusChange={handleRegistrationPaymentStatusChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortByChange={handleSortByChange}
        onSortOrderChange={handleSortOrderChange}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
      />
      {exportError && <p className="mb-3 text-xs text-red-600">{exportError}</p>}
      <div className="my-5 border-t border-zinc-100" />
      {rows.length === 0 ? (
        <EmptyState
          title="No fully funded participants"
          description="No participants with fully funded applications were found for this program."
        />
      ) : (
        <FullyFundedParticipantsTable
          data={rows}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={handlePageChange}
          onForceSubmit={handleForceSubmit}
          submittingId={submittingId}
        />
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
