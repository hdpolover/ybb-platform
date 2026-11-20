// services/admin-dashboard/app/platform/deletion-requests/_components/DeletionTable.tsx
"use client";

import { UserX } from "lucide-react";
import { EmptyState } from "@/src/admin/empty-state";
import { Badge } from "@/src/ui/badge";
import { Select } from "@/src/ui/select";
import { Skeleton } from "@/src/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  DELETION_STATUS_OPTIONS,
  reasonLabel,
  statusLabel,
  truncateReason,
  type DeletionInsights,
} from "@/lib/deletion-insights";
import { Pager } from "../../audit/_components/Pager";

const STATUS_VARIANT: Record<string, "warning" | "success" | "secondary"> = {
  approved: "warning",
  completed: "success",
  cancelled: "secondary",
};

type Props = {
  requests: DeletionInsights["requests"];
  status: string;
  loading: boolean;
  onStatus: (status: string) => void;
  onPage: (page: number) => void;
};

export function DeletionTable({ requests, status, loading, onStatus, onPage }: Props) {
  return (
    <section className="space-y-3">
      <div className="max-w-xs">
        <Select label="Status" value={status} onChange={(e) => onStatus(e.target.value)}>
          {DELETION_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-md border border-zinc-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Requested (WIB)</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scheduled / purged</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell colSpan={7}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : requests.items.map((r) => (
                  // Read-only rows: no hover tone.
                  <TableRow key={r.id} className="hover:bg-transparent">
                    <TableCell className="whitespace-nowrap text-xs text-zinc-600">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell className="text-xs">
                      {r.user ? (
                        <>
                          <div className="font-medium text-zinc-800">{r.user.name || "—"}</div>
                          <div className="text-zinc-500">{r.user.email ?? ""}</div>
                        </>
                      ) : (
                        <span className="text-zinc-500">Deleted user</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-700">{r.brand ?? "—"}</TableCell>
                    <TableCell className="text-xs text-zinc-700">{reasonLabel(r.reasonCategory)}</TableCell>
                    <TableCell className="max-w-[16rem] text-xs text-zinc-600" title={r.reason ?? undefined}>
                      {truncateReason(r.reason)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{statusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-zinc-600">
                      {formatDate(r.status === "completed" ? r.actualDeletionDate : r.scheduledDeletionDate)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!loading && requests.items.length === 0 && (
          <EmptyState icon={UserX} title="No deletion requests" description="Nothing matches this status." />
        )}
      </div>

      <Pager page={requests.page} totalPages={requests.lastPage} total={requests.total} onPage={onPage} />
    </section>
  );
}
