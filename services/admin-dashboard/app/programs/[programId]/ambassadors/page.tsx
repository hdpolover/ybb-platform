"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye, Mail, Pencil, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  activateAmbassador,
  createAmbassador,
  deactivateAmbassador,
  deleteAmbassador,
  listAmbassadors,
  resendAmbassadorCredentials,
  updateAmbassador,
  type Ambassador,
} from "@/src/shared/api-client";
import { PageHeader } from "@/src/admin/page-header";
import { StatusBadge } from "@/src/admin/status-badge";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { EnglishInput } from "@/src/ui/english-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { FilterField } from "@/src/ui/filter-grid";
import { FilterSelect } from "@/src/ui/select";
import { FilterPanel, type FilterPanelActiveFilter } from "@/src/ui/filter-panel";
import { RowActions } from "@/src/ui/row-actions";

type SortByType =
  | 'fullName'
  | 'referralCode'
  | 'institution'
  | 'isActive'
  | 'totalReferrals'
  | 'successfulReferrals'
  | 'lastReferralAt'
  | 'createdAt';

const SORT_BY_VALUES = [
  'fullName',
  'referralCode',
  'institution',
  'isActive',
  'totalReferrals',
  'successfulReferrals',
  'lastReferralAt',
  'createdAt',
] as const;
const SORT_ORDER_VALUES = ["asc", "desc"] as const;

const SORT_BY_OPTIONS: Array<{ value: SortByType; label: string }> = [
  { value: "fullName", label: "Name" },
  { value: "referralCode", label: "Referral Code" },
  { value: "institution", label: "Institution" },
  { value: "isActive", label: "Status" },
  { value: "totalReferrals", label: "Total Referrals" },
  { value: "successfulReferrals", label: "Successful Referrals" },
  { value: "lastReferralAt", label: "Last Referral" },
  { value: "createdAt", label: "Created At" },
];

const SORT_ORDER_OPTIONS: Array<{ value: (typeof SORT_ORDER_VALUES)[number]; label: string }> = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

// URL-persisted filter state (nuqs) — mirrors the pattern in
// app/programs/[programId]/payments/page.tsx.
const ambassadorsFilterParsers = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  sortBy: parseAsStringEnum([...SORT_BY_VALUES]).withDefault("totalReferrals").withOptions({ clearOnDefault: true }),
  sortOrder: parseAsStringEnum([...SORT_ORDER_VALUES]).withDefault("desc").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
};

export default function AmbassadorsPage() {
  const params = useParams<{ programId: string }>();
  const { accessiblePrograms } = useAuth();

  const resolvedProgramId = useMemo(() => {
    const match = accessiblePrograms.find(
      (item) => item.programId === params.programId || item.programSlug === params.programId,
    );
    return match?.programId ?? params.programId;
  }, [accessiblePrograms, params.programId]);

  const [items, setItems] = useState<Ambassador[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All filters live in the URL via nuqs (batched updates -> single history write per change).
  const [filters, setFilters] = useQueryStates(ambassadorsFilterParsers);
  const { search, page, sortBy, sortOrder } = filters;

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

  const hasActiveFilters = Boolean(search || sortBy !== "totalReferrals" || sortOrder !== "desc");

  // No filterable fields beyond search/sort exist on this page, so there are
  // never any removable filter chips or advanced-filter count to show — sort
  // and order live in the advanced panel per the shared pattern but (like the
  // payments reference) are intentionally excluded from chips/count.
  const activeFilters: FilterPanelActiveFilter[] = useMemo(() => [], []);
  const advancedFilterCount = activeFilters.length;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Ambassador | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ambassador | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    fullName: "",
    phoneNumber: "",
    institution: "",
    gender: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await listAmbassadors({
        programId: resolvedProgramId,
        search: search || undefined,
        page,
        limit: 20,
        sortBy,
        sortOrder,
      });
      setItems(response.data);
      setMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ambassadors");
    } finally {
      setLoading(false);
    }
  }, [page, resolvedProgramId, search, sortBy, sortOrder]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const activeCount = items.filter((item) => item.isActive).length;
  const totalConverted = items.reduce((sum, item) => sum + item.successfulReferrals, 0);

  function openCreate() {
    setEditTarget(null);
    setForm({
      email: "",
      fullName: "",
      phoneNumber: "",
      institution: "",
      gender: "",
      notes: "",
    });
    setFormError(null);
    setSheetOpen(true);
  }

  function openEdit(ambassador: Ambassador) {
    setEditTarget(ambassador);
    setForm({
      email: ambassador.user?.email ?? "",
      fullName: ambassador.fullName,
      phoneNumber: ambassador.phoneNumber ?? "",
      institution: ambassador.institution ?? "",
      gender: ambassador.gender ?? "",
      notes: ambassador.notes ?? "",
    });
    setFormError(null);
    setSheetOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      if (editTarget) {
        await updateAmbassador(editTarget.id, {
          fullName: form.fullName || undefined,
          phoneNumber: form.phoneNumber || undefined,
          institution: form.institution || undefined,
          gender: form.gender || undefined,
          notes: form.notes || undefined,
        });
      } else {
        await createAmbassador({
          email: form.email,
          fullName: form.fullName,
          programId: resolvedProgramId,
          phoneNumber: form.phoneNumber || undefined,
          institution: form.institution || undefined,
          gender: form.gender || undefined,
          notes: form.notes || undefined,
        });
      }
      setSheetOpen(false);
      void fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(ambassador: Ambassador) {
    try {
      if (ambassador.isActive) {
        await deactivateAmbassador(ambassador.id);
      } else {
        await activateAmbassador(ambassador.id);
      }
      void fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  function handleSort(key: SortByType) {
    if (key === sortBy) {
      void setFilters({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc', page: 1 });
    } else {
      const defaultDescKeys: SortByType[] = ['totalReferrals', 'successfulReferrals', 'lastReferralAt'];
      void setFilters({ sortBy: key, sortOrder: defaultDescKeys.includes(key) ? 'desc' : 'asc', page: 1 });
    }
  }

  const clearFilters = useCallback(() => {
    setSearchInput("");
    lastSyncedSearch.current = "";
    void setFilters({ search: null, sortBy: null, sortOrder: null, page: null });
  }, [setFilters]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAmbassador(deleteTarget.id);
      setDeleteTarget(null);
      void fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ambassador");
    }
  }

  async function handleResendCredentials(ambassador: Ambassador) {
    setResendingId(ambassador.id);
    try {
      await resendAmbassadorCredentials(ambassador.id);
      toast.success(`Credentials sent to ${ambassador.user?.email ?? ambassador.fullName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend credentials");
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ambassadors"
        description="Manage ambassadors, review referrals, and open detail pages for audit."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Add Ambassador
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Total Ambassadors</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-zinc-900">
            {loading ? "—" : meta.total}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Active</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-emerald-600">
            {loading ? "—" : activeCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Converted Referrals</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-blue-600">
            {loading ? "—" : totalConverted}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="space-y-3 border-b border-zinc-200 px-4 py-3">
          <FilterPanel
            search={{
              value: searchInput,
              onChange: setSearchInput,
              placeholder: "Search by name, code, or email…",
            }}
            primary={null}
            advancedCount={advancedFilterCount}
            activeFilters={activeFilters}
            resultCount={loading ? undefined : items.length}
            onClear={clearFilters}
            clearDisabled={!hasActiveFilters}
            advanced={
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
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
              </div>
            }
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('fullName')}
              >
                <button type="button" className="flex items-center gap-1 w-full text-left font-medium">
                  Ambassador
                  {sortBy === 'fullName' ? (
                    sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('referralCode')}
              >
                <button type="button" className="flex items-center gap-1 w-full text-left font-medium">
                  Referral Code
                  {sortBy === 'referralCode' ? (
                    sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('totalReferrals')}
              >
                <button type="button" className="flex items-center gap-1 w-full text-left font-medium">
                  Referrals
                  {sortBy === 'totalReferrals' ? (
                    sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('institution')}
              >
                <button type="button" className="flex items-center gap-1 w-full text-left font-medium">
                  Institution
                  {sortBy === 'institution' ? (
                    sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort('isActive')}
              >
                <button type="button" className="flex items-center gap-1 w-full text-left font-medium">
                  Status
                  {sortBy === 'isActive' ? (
                    sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-zinc-400">
                  Loading ambassadors…
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-zinc-400">
                  No ambassadors found.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((ambassador) => (
                <TableRow key={ambassador.id}>
                  <TableCell>
                    <div className="font-medium text-zinc-900">{ambassador.fullName}</div>
                    <div className="text-xs text-zinc-500">{ambassador.user?.email ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs">
                      {ambassador.referralCode}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-zinc-900">{ambassador.totalReferrals}</div>
                    <div className="text-xs text-zinc-500">
                      {ambassador.successfulReferrals} converted
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">
                    {ambassador.institution ?? "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(ambassador)}
                      className="rounded-full"
                    >
                      <StatusBadge
                        status={ambassador.isActive ? "active" : "inactive"}
                        context="generic"
                      />
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      primary={[
                        {
                          label: "View",
                          icon: Eye,
                          href: `/programs/${params.programId}/ambassadors/${ambassador.id}`,
                        },
                      ]}
                      menu={[
                        {
                          label: "Edit",
                          icon: Pencil,
                          onClick: () => openEdit(ambassador),
                        },
                        {
                          label: resendingId === ambassador.id ? "Sending…" : "Resend credentials",
                          icon: Mail,
                          disabled: resendingId === ambassador.id,
                          onClick: () => void handleResendCredentials(ambassador),
                        },
                        {
                          label: "Delete",
                          icon: Trash2,
                          destructive: true,
                          onClick: () => setDeleteTarget(ambassador),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {meta.lastPage > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void setFilters({ page: page - 1 })}>
              Previous
            </Button>
            <span className="text-xs text-zinc-500">
              Page {page} of {meta.lastPage}
            </span>
            <Button variant="outline" size="sm" disabled={page >= meta.lastPage} onClick={() => void setFilters({ page: page + 1 })}>
              Next
            </Button>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="shrink-0 border-b border-zinc-200 px-6 py-4">
            <SheetTitle>{editTarget ? "Edit Ambassador" : "Add Ambassador"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {formError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>
            )}

            {!editTarget && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <EnglishInput
                type="text"
                restrictMode="name"
                value={form.fullName}
                onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Phone</label>
                <Input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((current) => ({ ...current, phoneNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-700">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm((current) => ({ ...current, gender: e.target.value }))}
                  className="block h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">— Select —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Institution</label>
              <Input
                type="text"
                value={form.institution}
                onChange={(e) => setForm((current) => ({ ...current, institution: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">Notes</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                className="block w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 px-6 py-4">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} loading={saving}>
              {editTarget ? "Save Changes" : "Create Ambassador"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Ambassador"
        description={`Remove ${deleteTarget?.fullName} as an ambassador? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
