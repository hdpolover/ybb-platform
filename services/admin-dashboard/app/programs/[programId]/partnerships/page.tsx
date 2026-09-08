// app/programs/[programId]/partnerships/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import { Handshake, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteProgramPartnershipEnquiry,
  getProgramPartnershipEnquiry,
  listProgramPartnershipEnquiries,
  updateProgramPartnershipEnquiry,
  type PartnershipEnquiry,
  type PartnershipEnquiryDetail,
} from "@/src/shared/api-client";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/src/admin/page-header";
import { EmptyState } from "@/src/admin/empty-state";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { Badge } from "@/src/ui/badge";
import { Button } from "@/src/ui/button";
import { Skeleton } from "@/src/ui/skeleton";
import { FilterSelect } from "@/src/ui/select";
import { FilterPanel, type FilterPanelActiveFilter } from "@/src/ui/filter-panel";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/src/ui/table";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred";
}

function toTitleCase(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Free-text status column (VarChar(20), no CHECK constraint on the backend),
// so this is a display convenience, not an exhaustive enum — an unrecognized
// value still renders, just without a curated color.
const STATUS_OPTIONS = ["pending", "contacted", "resolved", "rejected"] as const;

const STATUS_VARIANT: Record<string, "pending" | "info" | "success" | "destructive" | "secondary"> = {
  pending: "pending",
  contacted: "info",
  resolved: "success",
  rejected: "destructive",
};

// Matches the four partnershipType values seen in prod as of 2026-09-08.
// New types submitted from the public form still show up in the list (the
// filter is additive, not a value allowlist) — they just won't have a
// dedicated option in this dropdown until added here.
const PARTNERSHIP_TYPE_OPTIONS = [
  "ambassador-program",
  "partnership",
  "affiliate-program",
  "community-institution",
] as const;

const TEXTAREA_CLS =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50";

// URL-persisted filter + selection state (nuqs) — mirrors the pattern in
// app/programs/[programId]/support-tickets/page.tsx. `enquiry` additionally
// mirrors the two-pane selection so a link to one enquiry is shareable and
// survives a refresh.
const partnershipsFilterParsers = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  status: parseAsStringEnum(["", ...STATUS_OPTIONS]).withDefault("").withOptions({ clearOnDefault: true }),
  type: parseAsStringEnum(["", ...PARTNERSHIP_TYPE_OPTIONS]).withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  enquiry: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
};

export default function ProgramPartnershipsPage() {
  const params = useParams<{ programId: string }>();
  const resolvedProgramId = useResolvedProgramId(params.programId);

  const [filters, setFilters] = useQueryStates(partnershipsFilterParsers);
  const { search: searchQuery, status: statusFilter, type: typeFilter, page, enquiry: selectedId } = filters;

  // Local input state so typing feels instant; synced to the nuqs-backed
  // `search` filter on a short debounce, same as support-tickets.
  const [searchInput, setSearchInput] = useState(searchQuery);
  const lastSyncedSearch = useRef(searchQuery);

  useEffect(() => {
    if (searchQuery !== lastSyncedSearch.current) {
      lastSyncedSearch.current = searchQuery;
      setSearchInput(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== searchQuery) {
        lastSyncedSearch.current = searchInput;
        void setFilters({ search: searchInput || null, page: 1 });
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasActiveFilters = Boolean(searchQuery || statusFilter || typeFilter);
  const clearFilters = useCallback(() => {
    setSearchInput("");
    lastSyncedSearch.current = "";
    void setFilters({ search: null, status: null, type: null, page: null });
  }, [setFilters]);

  const activeFilters: FilterPanelActiveFilter[] = useMemo(() => {
    const chips: FilterPanelActiveFilter[] = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${toTitleCase(statusFilter)}`,
        onRemove: () => void setFilters({ status: null, page: 1 }),
      });
    }
    if (typeFilter) {
      chips.push({
        key: "type",
        label: `Type: ${toTitleCase(typeFilter)}`,
        onRemove: () => void setFilters({ type: null, page: 1 }),
      });
    }
    return chips;
  }, [statusFilter, typeFilter, setFilters]);

  const [items, setItems] = useState<PartnershipEnquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [detail, setDetail] = useState<PartnershipEnquiryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Local edit buffer for the detail pane (status + notes) so typing in the
  // notes box doesn't refetch or re-render the list on every keystroke.
  const [statusDraft, setStatusDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PartnershipEnquiryDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoadingList(true);
    setError(null);
    try {
      const response = await listProgramPartnershipEnquiries(resolvedProgramId, {
        page,
        limit,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        search: searchQuery || undefined,
      });
      setItems(response.data ?? []);
      setTotal(response.meta?.total ?? 0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingList(false);
    }
  }, [limit, page, resolvedProgramId, searchQuery, statusFilter, typeFilter]);

  const fetchDetail = useCallback(async () => {
    if (!resolvedProgramId || !selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const found = await getProgramPartnershipEnquiry(resolvedProgramId, selectedId);
      setDetail(found);
      setStatusDraft(found.status);
      setNotesDraft(found.notes ?? "");
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDetail(null);
      void setFilters({ enquiry: null });
    } finally {
      setLoadingDetail(false);
    }
  }, [resolvedProgramId, selectedId, setFilters]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const detailDirty = detail != null && (statusDraft !== detail.status || notesDraft !== (detail.notes ?? ""));

  async function handleSaveDetail() {
    if (!resolvedProgramId || !detail) return;
    setSavingDetail(true);
    try {
      const updated = await updateProgramPartnershipEnquiry(resolvedProgramId, detail.id, {
        status: statusDraft !== detail.status ? statusDraft : undefined,
        notes: notesDraft !== (detail.notes ?? "") ? notesDraft : undefined,
      });
      setDetail(updated);
      setStatusDraft(updated.status);
      setNotesDraft(updated.notes ?? "");
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, status: updated.status } : item)),
      );
      toast.success("Enquiry updated.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!resolvedProgramId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProgramPartnershipEnquiry(resolvedProgramId, deleteTarget.id);
      toast.success("Enquiry deleted.");
      setDeleteTarget(null);
      setDetail(null);
      void setFilters({ enquiry: null });
      void fetchList();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partnership Enquiries"
        description="Inbound partnership and sponsorship submissions from the public partners page."
      />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[480px_minmax(0,1fr)]">
        {/* LEFT: list panel */}
        <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] text-zinc-500">{total} enquiry(s)</p>
            <Button variant="ghost" size="sm" onClick={() => void fetchList()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          <div className="mb-3">
            <FilterPanel
              search={{
                value: searchInput,
                onChange: setSearchInput,
                placeholder: "Search by name, email, company, or subject",
              }}
              primary={
                <>
                  <div className="w-full">
                    <FilterSelect
                      aria-label="Status"
                      value={statusFilter}
                      onChange={(e) =>
                        void setFilters({
                          status: (e.target.value || null) as typeof statusFilter | null,
                          page: 1,
                        })
                      }
                    >
                      <option value="">All statuses</option>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {toTitleCase(status)}
                        </option>
                      ))}
                    </FilterSelect>
                  </div>
                  <div className="w-full">
                    <FilterSelect
                      aria-label="Type"
                      value={typeFilter}
                      onChange={(e) =>
                        void setFilters({
                          type: (e.target.value || null) as typeof typeFilter | null,
                          page: 1,
                        })
                      }
                    >
                      <option value="">All types</option>
                      {PARTNERSHIP_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {toTitleCase(type)}
                        </option>
                      ))}
                    </FilterSelect>
                  </div>
                </>
              }
              advancedCount={0}
              activeFilters={activeFilters}
              resultCount={total}
              onClear={clearFilters}
              clearDisabled={!hasActiveFilters}
            />
          </div>

          {loadingList ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-zinc-100 p-3 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : null}

          {!loadingList && items.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="No partnership enquiries found"
              description="Nothing matches these filters yet, or none have come in."
            />
          ) : null}

          {!loadingList && items.length > 0 ? (
            <div className="max-h-[600px] flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      data-state={selectedId === item.id ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => void setFilters({ enquiry: item.id })}
                    >
                      <TableCell>
                        <p className="font-medium text-zinc-900">{item.fullName}</p>
                        <p className="text-xs text-zinc-500">{item.email}</p>
                        {item.company ? <p className="text-xs text-zinc-400">{item.company}</p> : null}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600">{toTitleCase(item.partnershipType)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[item.status] ?? "secondary"}>
                          {toTitleCase(item.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => void setFilters({ page: page - 1 })}
              >
                Previous
              </Button>
              <span className="text-[11px] text-zinc-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => void setFilters({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>

        {/* RIGHT: detail panel */}
        <div className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {!selectedId && !loadingDetail ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-400">
              Select an enquiry to view details.
            </div>
          ) : null}

          {selectedId && loadingDetail ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null}

          {detail && !loadingDetail ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex-shrink-0 border-b border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">{detail.fullName}</h2>
                    <p className="text-xs text-zinc-500">{detail.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setDeleteTarget(detail)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <Badge variant="secondary">{toTitleCase(detail.partnershipType)}</Badge>
                  {detail.subCategory ? <Badge variant="outline">{toTitleCase(detail.subCategory)}</Badge> : null}
                  <span>Submitted {formatDateTime(detail.createdAt)}</span>
                  {detail.handledAt ? <span>· Last handled {formatDateTime(detail.handledAt)}</span> : null}
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detail.company ? (
                    <div>
                      <p className="text-[11px] font-medium text-zinc-500">Company</p>
                      <p className="text-zinc-800">{detail.company}</p>
                    </div>
                  ) : null}
                  {detail.whatsappNumber ? (
                    <div>
                      <p className="text-[11px] font-medium text-zinc-500">WhatsApp</p>
                      <p className="text-zinc-800">{detail.whatsappNumber}</p>
                    </div>
                  ) : null}
                </div>

                {detail.subject ? (
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500">Subject</p>
                    <p className="text-sm text-zinc-800">{detail.subject}</p>
                  </div>
                ) : null}

                {/* The full, un-clamped description — the single most
                    user-visible gap in the old hand-rolled page, which
                    line-clamped this to 2 lines with no way to read the rest. */}
                <div>
                  <p className="text-[11px] font-medium text-zinc-500">Description</p>
                  <p className="whitespace-pre-wrap text-sm text-zinc-800">
                    {detail.description || "No description provided."}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500" htmlFor="enquiry-status">
                    Status
                  </label>
                  <FilterSelect
                    id="enquiry-status"
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {toTitleCase(status)}
                      </option>
                    ))}
                  </FilterSelect>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500" htmlFor="enquiry-notes">
                    Internal notes
                  </label>
                  <textarea
                    id="enquiry-notes"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    placeholder="Not visible to the submitter — for admin coordination only."
                    className={TEXTAREA_CLS}
                  />
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-zinc-200 p-4">
                <Button
                  onClick={() => void handleSaveDetail()}
                  disabled={!detailDirty}
                  loading={savingDetail}
                  className="w-full"
                >
                  Save changes
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this enquiry?"
        description={
          deleteTarget
            ? `This removes "${deleteTarget.fullName}"'s enquiry from the list. It can be restored only by an engineer, from the database.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
