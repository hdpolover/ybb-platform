// services/admin-dashboard/app/platform/audit/_components/AdminActivityTab.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Download, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/src/admin/empty-state";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Select } from "@/src/ui/select";
import { Skeleton } from "@/src/ui/skeleton";
import { FilterActions, FilterField, FilterGrid } from "@/src/ui/filter-grid";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import { formatDateTime } from "@/lib/utils";
import {
  AUDIT_ACTIONS,
  AUDIT_PAGE_SIZE,
  adminLabel,
  defaultActivityFilters,
  shortId,
  type AdminOption,
  type AuditActivityFilters,
} from "@/lib/audit-log";
import { exportAuditLogs, listAuditLogs, type AuditLogEntry } from "@/src/shared/api-client";
import { ActionBadge } from "./ActionBadge";
import { AdminSelect, DateRangeFields } from "./AuditFilterFields";
import { AuditEntryDrawer } from "./AuditEntryDrawer";
import { Pager } from "./Pager";

const SEARCH_DEBOUNCE_MS = 400;
const SECONDS = { second: "2-digit" } as const;

export function AdminActivityTab({ admins }: { admins: AdminOption[] }) {
  const [filters, setFilters] = useState<AuditActivityFilters>(() => defaultActivityFilters());
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);

  const adminMap = useMemo(() => new Map(admins.map((a) => [a.id, a])), [admins]);

  function updateFilters(patch: Partial<AuditActivityFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  // Typing in search waits for a pause before it hits the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
      setPage((p) => (p === 1 ? p : 1));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const id = ++requestId.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch below
    setLoading(true);
    setError(null);
    listAuditLogs(filters, page, AUDIT_PAGE_SIZE)
      .then((res) => {
        if (id !== requestId.current) return;
        setRows(res.data);
        setMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
      })
      .catch((err: unknown) => {
        if (id === requestId.current) setError(err instanceof Error ? err.message : "Failed to load activity");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [filters, page]);

  function clearFilters() {
    setSearchInput("");
    setFilters(defaultActivityFilters());
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportAuditLogs(filters);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <FilterGrid>
          <AdminSelect admins={admins} value={filters.adminId} onChange={(adminId) => updateFilters({ adminId })} />
          <FilterField label="Entity type" htmlFor="audit-entity">
            <Input
              id="audit-entity"
              placeholder="e.g. ParticipantApplication"
              value={filters.entityType}
              onChange={(e) => updateFilters({ entityType: e.target.value })}
            />
          </FilterField>
          <FilterField label="Action" htmlFor="audit-action">
            <Select id="audit-action" value={filters.action} onChange={(e) => updateFilters({ action: e.target.value })}>
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Search" htmlFor="audit-search">
            <Input
              id="audit-search"
              placeholder="Endpoint, event or entity type"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </FilterField>
          <DateRangeFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={updateFilters} />
        </FilterGrid>
        <div className="flex items-center justify-between gap-2">
          <FilterActions resultCount={meta.total} onClear={clearFilters} className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => void handleExport()} disabled={exporting}>
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Exporting…" : "Export (.xlsx)"}
          </Button>
        </div>
      </section>

      {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className="rounded-md border border-zinc-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Time (WIB)</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.map((r) => (
              <TableRow
                key={r.id}
                tabIndex={0}
                aria-label="View change details"
                className="cursor-pointer"
                onClick={() => setSelected(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(r);
                  }
                }}
              >
                <TableCell className="whitespace-nowrap text-xs text-zinc-600">{formatDateTime(r.createdAt, SECONDS)}</TableCell>
                <TableCell className="text-xs text-zinc-800">{adminLabel(adminMap, r.actorId)}</TableCell>
                <TableCell><ActionBadge action={r.action} /></TableCell>
                <TableCell className="text-xs">
                  <span className="text-zinc-800">{r.entityType}</span>{" "}
                  <span className="font-mono text-zinc-400" title={r.entityId ?? undefined}>{shortId(r.entityId)}</span>
                </TableCell>
                <TableCell className="max-w-[16rem] truncate font-mono text-[11px] text-zinc-600" title={r.endpoint ?? undefined}>
                  {r.endpoint ?? "—"}
                </TableCell>
                <TableCell className="text-zinc-400"><ChevronRight className="h-4 w-4" aria-hidden="true" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon={ScrollText}
            title="No admin activity found"
            description="Nothing matches these filters. Widen the date range or clear a filter."
          />
        )}
      </section>

      <Pager page={page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      <AuditEntryDrawer key={selected?.id ?? "closed"} entry={selected} admins={adminMap} onClose={() => setSelected(null)} />
    </div>
  );
}
