// services/admin-dashboard/app/platform/audit/_components/AdminLoginsTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { EmptyState } from "@/src/admin/empty-state";
import { Badge } from "@/src/ui/badge";
import { Skeleton } from "@/src/ui/skeleton";
import { FilterActions, FilterGrid } from "@/src/ui/filter-grid";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import { formatDateTime } from "@/lib/utils";
import { AUDIT_PAGE_SIZE, defaultDateRange, shortUserAgent, type AdminOption, type SecurityEventFilters } from "@/lib/audit-log";
import { listAdminSecurityEvents, type AdminSecurityEvent } from "@/src/shared/api-client";
import { AdminSelect, DateRangeFields } from "./AuditFilterFields";
import { Pager } from "./Pager";

const SECONDS = { second: "2-digit" } as const;

const defaultFilters = (): SecurityEventFilters => ({ adminId: "", ...defaultDateRange() });

/** LOGIN_FAILED -> "Login failed". */
const eventLabel = (t: string) => {
  const words = t.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function AdminLoginsTab({ admins }: { admins: AdminOption[] }) {
  const [filters, setFilters] = useState<SecurityEventFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminSecurityEvent[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch below
    setLoading(true);
    setError(null);
    listAdminSecurityEvents(filters, page, AUDIT_PAGE_SIZE)
      .then((res) => {
        if (id !== requestId.current) return;
        setRows(res.data);
        setMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
      })
      .catch((err: unknown) => {
        if (id === requestId.current) setError(err instanceof Error ? err.message : "Failed to load logins");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [filters, page]);

  function updateFilters(patch: Partial<SecurityEventFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <FilterGrid>
          <AdminSelect admins={admins} value={filters.adminId} onChange={(adminId) => updateFilters({ adminId })} />
          <DateRangeFields dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={updateFilters} />
        </FilterGrid>
        <FilterActions
          resultCount={meta.total}
          onClear={() => {
            setFilters(defaultFilters());
            setPage(1);
          }}
        />
      </section>

      {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className="rounded-md border border-zinc-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Time (WIB)</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Browser</TableHead>
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
              // Not clickable, so no hover tone.
              <TableRow key={r.id} className="hover:bg-transparent">
                <TableCell className="whitespace-nowrap text-xs text-zinc-600">{formatDateTime(r.createdAt, SECONDS)}</TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium text-zinc-800">{r.adminName ?? "—"}</div>
                  <div className="text-zinc-500">{r.adminEmail ?? ""}</div>
                </TableCell>
                <TableCell className="text-xs text-zinc-800">{eventLabel(r.eventType)}</TableCell>
                <TableCell>
                  <Badge variant={r.eventStatus.toUpperCase() === "SUCCESS" ? "success" : "destructive"}>
                    {r.eventStatus.toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-zinc-600">{r.ipAddress ?? "—"}</TableCell>
                <TableCell className="text-xs text-zinc-600" title={r.userAgent ?? undefined}>
                  {shortUserAgent(r.userAgent)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon={KeyRound}
            title="No admin logins found"
            description="Nothing matches these filters. Widen the date range or pick another admin."
          />
        )}
      </section>

      <Pager page={page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
    </div>
  );
}
