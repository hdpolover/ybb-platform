"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  listProgramPartnershipEnquiries,
  updateProgramPartnershipEnquiryStatus,
  type PartnershipEnquiry,
} from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

const STATUS_OPTIONS = ["pending", "contacted", "resolved", "rejected"] as const;

export default function ProgramPartnershipsPage() {
  const params = useParams<{ programId: string }>();
  const resolvedProgramId = useResolvedProgramId(params.programId);
  const { accessiblePrograms } = useAuth();

  const programName = useMemo(
    () =>
      accessiblePrograms.find((p) => p.programId === params.programId || p.programSlug === params.programId)
        ?.programName ?? "Selected Program",
    [accessiblePrograms, params.programId],
  );

  const [items, setItems] = useState<PartnershipEnquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const limit = 20;

  const fetchPartnershipEnquiries = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await listProgramPartnershipEnquiries(resolvedProgramId, {
        page,
        limit,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setItems(response.data ?? []);
      setTotal(response.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load partnership enquiries.");
    } finally {
      setLoading(false);
    }
  }, [limit, page, resolvedProgramId, searchQuery, statusFilter]);

  useEffect(() => {
    void fetchPartnershipEnquiries();
  }, [fetchPartnershipEnquiries]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  async function handleStatusChange(enquiryId: string, nextStatus: string) {
    setUpdatingId(enquiryId);
    setError(null);
    try {
      const updated = await updateProgramPartnershipEnquiryStatus(resolvedProgramId, enquiryId, nextStatus);
      setItems((current) =>
        current.map((item) =>
          item.id === enquiryId
            ? {
                ...item,
                status: updated.status,
                updatedAt: updated.updatedAt,
              }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update enquiry status.");
    } finally {
      setUpdatingId(null);
    }
  }

  function handleApplyFilters() {
    setPage(1);
    setSearchQuery(searchInput.trim());
  }

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Partnerships
        </div>
        <h1 className="mt-1 text-lg font-bold text-zinc-900">{programName} Partnership Enquiries</h1>
        <p className="text-sm text-zinc-500">
          Manage inbound partnership and sponsorship submissions from the public partners page.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-500">{total} enquiry(s)</p>
          <button
            type="button"
            onClick={() => void fetchPartnershipEnquiries()}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_200px_auto]">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, email, company, or subject"
              className="w-full rounded-md border border-zinc-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleApplyFilters();
                }
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleApplyFilters}
            className="rounded-md bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600"
          >
            Apply
          </button>
        </div>

        {error ? (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Contact</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Subject</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">
                    No partnership enquiries found.
                  </td>
                </tr>
              ) : null}
              {!loading &&
                items.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-zinc-900">{item.fullName}</p>
                      <p className="text-zinc-600">{item.email}</p>
                      {item.company ? <p className="text-zinc-500">{item.company}</p> : null}
                      {item.whatsappNumber ? <p className="text-zinc-500">{item.whatsappNumber}</p> : null}
                    </td>
                    <td className="px-3 py-2 align-top text-zinc-700">
                      <p className="font-medium">{item.partnershipType}</p>
                      {item.subCategory ? <p className="text-zinc-500">{item.subCategory}</p> : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-zinc-800">{item.subject ?? "—"}</p>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 max-w-md text-zinc-500">{item.description}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={item.status}
                        onChange={(event) => void handleStatusChange(item.id, event.target.value)}
                        disabled={updatingId === item.id}
                        className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top text-zinc-500">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
            >
              Previous
            </button>
            <span className="text-[11px] text-zinc-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
