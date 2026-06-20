"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import { listApplications, type Application } from "@/src/shared/api-client";
import { EmptyState } from "@/src/admin/empty-state";
import { formatDate } from "@/lib/utils";

interface InterviewParticipantsTableProps {
  onExport?: () => void;
  exporting?: boolean;
  programId?: string;
  search?: string;
  resolvedBrandId?: string;
}

export function InterviewParticipantsTable({
  onExport,
  exporting,
  programId,
  search,
}: InterviewParticipantsTableProps) {
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listApplications({
        programId,
        status: "interview_scheduled",
        search: search || undefined,
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
  }, [programId, search, page, pageSize]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const rows = items.map((app) => ({
    id: app.id,
    name: app.participant?.fullName ?? "Unknown",
    email: app.participant?.email ?? "",
    registeredOn: formatDate(app.createdAt),
    scoreStatus: app.scoreStatus ?? "Not Scored",
  }));

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-xs text-zinc-700 shadow-sm md:text-sm">
      <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-1">
          <span>Show</span>
          <select className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-700 focus:border-blue-500 focus:outline-none">
            <option>10</option>
            <option>25</option>
            <option>50</option>
          </select>
          <span>entries</span>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          <span>{exporting ? "Exporting..." : "Export Data"}</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">Participant Details</th>
              <th className="px-3 py-2">Registered On</th>
              <th className="px-3 py-2">Score Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <div className="py-8 text-center text-sm text-zinc-500">Loading...</div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-red-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6">
                  <EmptyState
                    title="No interview participants"
                    description="No participants are currently in the interview stage."
                  />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-500">
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-semibold text-zinc-900">{row.name}</div>
                    <div className="text-[11px] text-zinc-500">{row.email}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div>{row.registeredOn}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <ScoreStatusBadge status={row.scoreStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Showing {showingFrom} to {showingTo} of {total} entries
        </span>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page * pageSize >= total}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function ScoreStatusBadge({ status }: { status: string }) {
  let className = "bg-zinc-100 text-zinc-600";

  if (status === "High") className = "bg-emerald-100 text-emerald-700";
  else if (status === "Medium") className = "bg-amber-100 text-amber-700";
  else if (status === "Low") className = "bg-rose-100 text-rose-700";
  else className = "bg-zinc-100 text-zinc-600";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      {status}
    </span>
  );
}
