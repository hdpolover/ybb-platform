"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { getLoaDownloads } from "@/src/shared/api-client";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/src/admin/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";

interface LoaStatusTableProps {
  programId: string;
}

export function LoaStatusTable({ programId }: LoaStatusTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: downloads = [], isLoading } = useQuery({
    queryKey: ["loa-downloads", programId],
    queryFn: () => getLoaDownloads(programId),
  });

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return downloads;
    return downloads.filter(
      (row) =>
        row.participantName.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q),
    );
  }, [downloads, searchQuery]);

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-zinc-200 bg-white">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 border-b border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <span className="whitespace-nowrap text-xs text-zinc-400">
            Showing {filteredRows.length} of {downloads.length}
          </span>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center px-4 py-12 text-sm text-zinc-400">
            Loading downloads…
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={Download}
            title="No downloads yet"
            description="Downloads will appear here once participants open their LoA"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Document #</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>First Downloaded</TableHead>
                <TableHead>Downloads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-zinc-900">
                    {row.participantName}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">{row.email}</TableCell>
                  <TableCell className="font-mono text-xs text-zinc-600">
                    {row.documentNumber}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">
                    {row.batchName ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">
                    {row.firstDownloadedAt ? formatDateTime(row.firstDownloadedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-700">
                    {row.downloadCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
