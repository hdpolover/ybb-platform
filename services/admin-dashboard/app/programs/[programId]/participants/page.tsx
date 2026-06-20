"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  exportApplicationsExcel,
  listApplications,
  type Application,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { EmptyState } from "@/src/admin/empty-state";
import { formatDate } from "@/lib/utils";

const regionNames = typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
function formatCountry(raw: string | null | undefined): string {
  if (!raw) return "—";
  if (regionNames && /^[A-Z]{2}$/.test(raw)) {
    try { return regionNames.of(raw) ?? raw; } catch { return raw; }
  }
  return raw;
}

const PAYMENT_BADGE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  UNPAID: "bg-red-50 text-red-700",
  unpaid: "bg-red-50 text-red-700",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  interview_scheduled: "bg-purple-50 text-purple-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  waitlisted: "bg-orange-50 text-orange-700",
  withdrawn: "bg-zinc-100 text-zinc-500",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  interview_scheduled: "Interview",
  accepted: "Accepted",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "interview_scheduled", label: "Interview" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "draft", label: "Draft" },
  { value: "withdrawn", label: "Withdrawn" },
];

const CATEGORY_FILTERS = [
  { value: "", label: "All categories" },
  { value: "fully_funded", label: "Fully Funded" },
  { value: "self_funded", label: "Self Funded" },
] as const;

const PAYMENT_STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
] as const;

const SORT_BY_OPTIONS = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "createdAt", label: "Created At" },
  { value: "submittedAt", label: "Submitted At" },
  { value: "participantName", label: "Participant Name" },
  { value: "country", label: "Country" },
  { value: "status", label: "Status" },
  { value: "registrationPaymentStatus", label: "Reg. Payment" },
  { value: "programPaymentStatus", label: "Prog. Payment" },
] as const;

const SORT_ORDER_OPTIONS = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
] as const;

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function ParticipantsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();

  const resolvedProgram = useMemo(() => {
    return accessiblePrograms.find(
      (p) => p.programId === params.programId || p.programSlug === params.programId,
    );
  }, [accessiblePrograms, params.programId]);
  const resolvedProgramId = resolvedProgram?.programId ?? params.programId;
  const resolvedBrandId = resolvedProgram?.brandId ?? "";

  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"" | "fully_funded" | "self_funded">("");
  const [countryFilter, setCountryFilter] = useState("");
  const [registrationPaymentStatusFilter, setRegistrationPaymentStatusFilter] = useState<"" | "unpaid" | "paid" | "processing" | "failed" | "cancelled" | "refunded">("");
  const [programPaymentStatusFilter, setProgramPaymentStatusFilter] = useState<"" | "unpaid" | "paid" | "processing" | "failed" | "cancelled" | "refunded">("");
  const [sortBy, setSortBy] = useState<(typeof SORT_BY_OPTIONS)[number]["value"]>("updatedAt");
  const [sortOrder, setSortOrder] = useState<(typeof SORT_ORDER_OPTIONS)[number]["value"]>("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInvalidDateRange = Boolean(startDate && endDate && startDate > endDate);
  const hasActiveFilters = Boolean(
    search ||
      statusFilter ||
      categoryFilter ||
      countryFilter ||
      registrationPaymentStatusFilter ||
      programPaymentStatusFilter ||
      startDate ||
      endDate ||
      pageSize !== DEFAULT_PAGE_SIZE ||
      sortBy !== "updatedAt" ||
      sortOrder !== "desc",
  );
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : showingFrom + items.length - 1;

  const fetchParticipants = useCallback(async () => {
    if (!resolvedProgramId) return;

    if (hasInvalidDateRange) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setError("Start date must be on or before end date.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
        const res = await listApplications({
          programId: resolvedProgramId,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
          search: search || undefined,
          country: countryFilter || undefined,
          registrationPaymentStatus: registrationPaymentStatusFilter || undefined,
          programPaymentStatus: programPaymentStatusFilter || undefined,
          sortBy,
          sortOrder,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setItems(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [
    resolvedProgramId,
    hasInvalidDateRange,
    statusFilter,
    categoryFilter,
    search,
    countryFilter,
    registrationPaymentStatusFilter,
    programPaymentStatusFilter,
    sortBy,
    sortOrder,
    startDate,
    endDate,
    page,
    pageSize,
  ]);

  useEffect(() => {
    void fetchParticipants();
  }, [fetchParticipants]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pageSize, total]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const resetFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setCountryFilter("");
    setRegistrationPaymentStatusFilter("");
    setProgramPaymentStatusFilter("");
    setSortBy("updatedAt");
    setSortOrder("desc");
    setStartDate("");
    setEndDate("");
    setPageSize(DEFAULT_PAGE_SIZE);
    setPage(1);
    setError(null);
  }, []);

  const handleExport = useCallback(async () => {
    if (!resolvedBrandId) {
      setError("Export is unavailable because this program brand could not be resolved.");
      return;
    }

    if (hasInvalidDateRange) {
      setError("Start date must be on or before end date.");
      return;
    }

    setExporting(true);
    setError(null);
    try {
      await exportApplicationsExcel({
        brandId: resolvedBrandId,
        programId: resolvedProgramId,
        status: statusFilter || undefined,
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export participants.");
    } finally {
      setExporting(false);
    }
  }, [resolvedBrandId, resolvedProgramId, hasInvalidDateRange, statusFilter, search, startDate, endDate]);

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
              <UsersIcon className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Participants</p>
              <p className="text-xl font-bold text-zinc-900 leading-tight">{loading ? "—" : total.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>
              Showing {showingFrom}-{showingTo} of {total.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting || !resolvedBrandId}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-emerald-100"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_180px_180px_120px_auto]">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Search</label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="block w-full rounded-md border border-zinc-200 py-2 pl-8 pr-3 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Applied from</label>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Applied to</label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Page size</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => void fetchParticipants()}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-zinc-50"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as "" | "fully_funded" | "self_funded");
                setPage(1);
              }}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {CATEGORY_FILTERS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Country</label>
            <input
              type="text"
              value={countryFilter}
              placeholder="e.g. Indonesia"
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Reg. Payment</label>
            <select
              value={registrationPaymentStatusFilter}
              onChange={(e) => {
                setRegistrationPaymentStatusFilter(e.target.value as "" | "unpaid" | "paid" | "processing" | "failed" | "cancelled" | "refunded");
                setPage(1);
              }}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {PAYMENT_STATUS_FILTERS.map((option) => (
                <option key={`reg-${option.value || "all"}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Prog. Payment</label>
            <select
              value={programPaymentStatusFilter}
              onChange={(e) => {
                setProgramPaymentStatusFilter(e.target.value as "" | "unpaid" | "paid" | "processing" | "failed" | "cancelled" | "refunded");
                setPage(1);
              }}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {PAYMENT_STATUS_FILTERS.map((option) => (
                <option key={`prog-${option.value || "all"}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as (typeof SORT_BY_OPTIONS)[number]["value"]);
                setPage(1);
              }}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {SORT_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Sort order</label>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as (typeof SORT_ORDER_OPTIONS)[number]["value"]);
                setPage(1);
              }}
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {SORT_ORDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={
                "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors " +
                (statusFilter === f.value
                  ? "border-zinc-800 bg-zinc-800 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Participant</th>
                <th className="px-3 py-2 font-semibold">Country</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Reg. Payment</th>
                <th className="px-3 py-2 font-semibold">Prog. Payment</th>
                <th className="px-3 py-2 font-semibold">Created At</th>
                <th className="px-3 py-2 font-semibold">Updated At</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-400">Loading…</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-2">
                    <EmptyState
                      title="No participants found"
                      description="Try adjusting the search, status, payment, country, or date filters."
                      className="py-10"
                    />
                  </td>
                </tr>
              )}
              {!loading && items.map((app, idx) => (
                <tr
                  key={app.id}
                  className={(idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60") + " cursor-pointer hover:bg-blue-50/50 transition-colors"}
                >
                  <td className="px-3 py-2">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      <p className="font-medium text-zinc-900 hover:text-blue-600">{app.participant?.fullName ?? "—"}</p>
                      <p className="text-zinc-400">{app.participant?.email ?? ""}</p>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      {formatCountry(app.participant?.originCountry)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (STATUS_BADGE[app.status] ?? "bg-zinc-100 text-zinc-600")}>
                        {STATUS_LABEL[app.status] ?? app.status}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (PAYMENT_BADGE[app.registrationPaymentStatus] ?? "bg-zinc-100 text-zinc-600")}>
                        {app.registrationPaymentStatus}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + (PAYMENT_BADGE[app.programPaymentStatus] ?? "bg-zinc-100 text-zinc-600")}>
                        {app.programPaymentStatus}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      {formatDate(app.createdAt)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    <Link href={`/programs/${params.programId}/participants/${app.participantId}`} className="block">
                      {formatDate(app.updatedAt)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
