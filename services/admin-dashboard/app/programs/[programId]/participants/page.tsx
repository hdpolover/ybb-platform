"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import { Eye } from "lucide-react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import {
  exportApplicationsExcel,
  listApplications,
  type Application,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { EmptyState } from "@/src/admin/empty-state";
import { Input } from "@/src/ui/input";
import { FilterSelect } from "@/src/ui/select";
import { FilterField } from "@/src/ui/filter-grid";
import { FilterPanel, type FilterPanelActiveFilter } from "@/src/ui/filter-panel";
import { RowActions } from "@/src/ui/row-actions";
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

const CATEGORY_VALUES = ["", "fully_funded", "self_funded"] as const;
// Payment status filter type includes "cancelled" even though it isn't one of
// the selectable PAYMENT_STATUS_FILTERS options, matching the original state type.
const PAYMENT_STATUS_VALUES = ["", "unpaid", "paid", "processing", "failed", "cancelled", "refunded"] as const;
const SORT_BY_VALUES = [
  "updatedAt",
  "createdAt",
  "submittedAt",
  "participantName",
  "country",
  "status",
  "registrationPaymentStatus",
  "programPaymentStatus",
] as const;
const SORT_ORDER_VALUES = ["desc", "asc"] as const;

// URL-persisted filter state (nuqs) — mirrors the pattern in
// app/programs/[programId]/payments/page.tsx.
const participantsFilterParsers = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  status: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  category: parseAsStringEnum([...CATEGORY_VALUES]).withDefault("").withOptions({ clearOnDefault: true }),
  country: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  registrationPaymentStatus: parseAsStringEnum([...PAYMENT_STATUS_VALUES])
    .withDefault("")
    .withOptions({ clearOnDefault: true }),
  programPaymentStatus: parseAsStringEnum([...PAYMENT_STATUS_VALUES])
    .withDefault("")
    .withOptions({ clearOnDefault: true }),
  sortBy: parseAsStringEnum([...SORT_BY_VALUES]).withDefault("updatedAt").withOptions({ clearOnDefault: true }),
  sortOrder: parseAsStringEnum([...SORT_ORDER_VALUES]).withDefault("desc").withOptions({ clearOnDefault: true }),
  startDate: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  endDate: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  pageSize: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE).withOptions({ clearOnDefault: true }),
};

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
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All filters live in the URL via nuqs (batched updates -> single history write per change).
  const [filters, setFilters] = useQueryStates(participantsFilterParsers);
  const {
    page,
    pageSize,
    status: statusFilter,
    search,
    category: categoryFilter,
    country: countryFilter,
    registrationPaymentStatus: registrationPaymentStatusFilter,
    programPaymentStatus: programPaymentStatusFilter,
    sortBy,
    sortOrder,
    startDate,
    endDate,
  } = filters;

  // Local input state for the search box so typing feels instant; synced to
  // the nuqs-backed `search` filter on a short debounce so we don't write to
  // the URL (and refetch) on every keystroke.
  const [searchInput, setSearchInput] = useState(search);
  const lastSyncedSearch = useRef(search);

  useEffect(() => {
    if (search !== lastSyncedSearch.current) {
      lastSyncedSearch.current = search;
      setSearchInput(search);
    }
  }, [search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== search) {
        lastSyncedSearch.current = searchInput;
        void setFilters({ search: searchInput || null, page: 1 });
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

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
      void setFilters({ page: totalPages });
    }
  }, [page, pageSize, total, setFilters]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const clearFilters = useCallback(() => {
    setSearchInput("");
    lastSyncedSearch.current = "";
    setError(null);
    // Passing `null` resets every field to its parser default and drops it
    // from the URL (clearOnDefault: true) — a single batched update.
    void setFilters({
      search: null,
      status: null,
      category: null,
      country: null,
      registrationPaymentStatus: null,
      programPaymentStatus: null,
      sortBy: null,
      sortOrder: null,
      startDate: null,
      endDate: null,
      pageSize: null,
      page: null,
    });
  }, [setFilters]);

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

  // Chip keys that belong to the always-visible "primary" filters (Status,
  // Category) rather than the collapsible advanced panel — used to derive
  // `advancedFilterCount` below without double-counting.
  const PRIMARY_CHIP_KEYS = useMemo(() => new Set(["status", "category"]), []);

  const activeFilters: FilterPanelActiveFilter[] = useMemo(() => {
    const chips: FilterPanelActiveFilter[] = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${STATUS_FILTERS.find((o) => o.value === statusFilter)?.label ?? statusFilter}`,
        onRemove: () => void setFilters({ status: null, page: 1 }),
      });
    }
    if (categoryFilter) {
      chips.push({
        key: "category",
        label: `Category: ${CATEGORY_FILTERS.find((o) => o.value === categoryFilter)?.label ?? categoryFilter}`,
        onRemove: () => void setFilters({ category: null, page: 1 }),
      });
    }
    if (countryFilter) {
      chips.push({
        key: "country",
        label: `Country: ${countryFilter}`,
        onRemove: () => void setFilters({ country: null, page: 1 }),
      });
    }
    if (registrationPaymentStatusFilter) {
      chips.push({
        key: "registrationPaymentStatus",
        label: `Reg. Payment: ${
          PAYMENT_STATUS_FILTERS.find((o) => o.value === registrationPaymentStatusFilter)?.label ??
          registrationPaymentStatusFilter
        }`,
        onRemove: () => void setFilters({ registrationPaymentStatus: null, page: 1 }),
      });
    }
    if (programPaymentStatusFilter) {
      chips.push({
        key: "programPaymentStatus",
        label: `Prog. Payment: ${
          PAYMENT_STATUS_FILTERS.find((o) => o.value === programPaymentStatusFilter)?.label ??
          programPaymentStatusFilter
        }`,
        onRemove: () => void setFilters({ programPaymentStatus: null, page: 1 }),
      });
    }
    if (startDate) {
      chips.push({
        key: "startDate",
        label: `Applied from: ${formatDate(startDate)}`,
        onRemove: () => void setFilters({ startDate: null, page: 1 }),
      });
    }
    if (endDate) {
      chips.push({
        key: "endDate",
        label: `Applied to: ${formatDate(endDate)}`,
        onRemove: () => void setFilters({ endDate: null, page: 1 }),
      });
    }
    return chips;
  }, [
    statusFilter,
    categoryFilter,
    countryFilter,
    registrationPaymentStatusFilter,
    programPaymentStatusFilter,
    startDate,
    endDate,
    setFilters,
  ]);

  const advancedFilterCount = useMemo(
    () => activeFilters.filter((filter) => !PRIMARY_CHIP_KEYS.has(filter.key)).length,
    [activeFilters, PRIMARY_CHIP_KEYS],
  );

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
              onClick={() => void fetchParticipants()}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Refresh
            </button>
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

        <FilterPanel
          search={{
            value: searchInput,
            onChange: setSearchInput,
            placeholder: "Search by name or email...",
          }}
          primary={
            <>
              <div className="w-40">
                <FilterSelect
                  aria-label="Status"
                  value={statusFilter}
                  onChange={(e) => { void setFilters({ status: e.target.value || null, page: 1 }); }}
                >
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <div className="w-48">
                <FilterSelect
                  aria-label="Category"
                  value={categoryFilter}
                  onChange={(e) => {
                    void setFilters({ category: (e.target.value || null) as typeof categoryFilter | null, page: 1 });
                  }}
                >
                  {CATEGORY_FILTERS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FilterSelect>
              </div>
            </>
          }
          advancedCount={advancedFilterCount}
          activeFilters={activeFilters}
          resultCount={total}
          onClear={clearFilters}
          clearDisabled={!hasActiveFilters}
          advanced={
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
              <FilterField label="Country" htmlFor="filter-country">
                <Input
                  id="filter-country"
                  type="text"
                  value={countryFilter}
                  placeholder="e.g. Indonesia"
                  onChange={(e) => { void setFilters({ country: e.target.value || null, page: 1 }); }}
                  className="h-10 text-sm"
                />
              </FilterField>
              <FilterField label="Reg. Payment" htmlFor="filter-reg-payment">
                <FilterSelect
                  id="filter-reg-payment"
                  value={registrationPaymentStatusFilter}
                  onChange={(e) => {
                    void setFilters({
                      registrationPaymentStatus: (e.target.value || null) as typeof registrationPaymentStatusFilter | null,
                      page: 1,
                    });
                  }}
                >
                  {PAYMENT_STATUS_FILTERS.map((option) => (
                    <option key={`reg-${option.value || "all"}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FilterSelect>
              </FilterField>
              <FilterField label="Prog. Payment" htmlFor="filter-prog-payment">
                <FilterSelect
                  id="filter-prog-payment"
                  value={programPaymentStatusFilter}
                  onChange={(e) => {
                    void setFilters({
                      programPaymentStatus: (e.target.value || null) as typeof programPaymentStatusFilter | null,
                      page: 1,
                    });
                  }}
                >
                  {PAYMENT_STATUS_FILTERS.map((option) => (
                    <option key={`prog-${option.value || "all"}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FilterSelect>
              </FilterField>
              <FilterField label="Applied from" htmlFor="filter-start-date">
                <Input
                  id="filter-start-date"
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => { void setFilters({ startDate: e.target.value || null, page: 1 }); }}
                  className="h-10 text-sm"
                />
              </FilterField>
              <FilterField label="Applied to" htmlFor="filter-end-date">
                <Input
                  id="filter-end-date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => { void setFilters({ endDate: e.target.value || null, page: 1 }); }}
                  className="h-10 text-sm"
                />
              </FilterField>
              <FilterField label="Sort by" htmlFor="filter-sort-by">
                <FilterSelect
                  id="filter-sort-by"
                  value={sortBy}
                  onChange={(e) => { void setFilters({ sortBy: e.target.value as typeof sortBy, page: 1 }); }}
                >
                  {SORT_BY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FilterSelect>
              </FilterField>
              <FilterField label="Sort order" htmlFor="filter-sort-order">
                <FilterSelect
                  id="filter-sort-order"
                  value={sortOrder}
                  onChange={(e) => { void setFilters({ sortOrder: e.target.value as typeof sortOrder, page: 1 }); }}
                >
                  {SORT_ORDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FilterSelect>
              </FilterField>
              <FilterField label="Page size" htmlFor="filter-page-size">
                <FilterSelect
                  id="filter-page-size"
                  value={pageSize}
                  onChange={(e) => { void setFilters({ pageSize: Number(e.target.value), page: 1 }); }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </FilterSelect>
              </FilterField>
            </div>
          }
        />
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
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">Loading…</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-2">
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
                  <td className="px-3 py-2 text-right">
                    <RowActions
                      primary={[
                        {
                          label: "View",
                          icon: Eye,
                          href: `/programs/${params.programId}/participants/${app.participantId}`,
                        },
                      ]}
                    />
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
              onClick={() => void setFilters({ page: page - 1 })}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 disabled:opacity-40 hover:bg-zinc-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => void setFilters({ page: page + 1 })}
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
