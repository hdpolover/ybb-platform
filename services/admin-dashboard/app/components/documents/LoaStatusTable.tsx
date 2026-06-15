"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { sendLoa, type LoaStatusRow } from "@/src/shared/api-client";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/src/ui/badge";
import { EmptyState } from "@/src/admin/empty-state";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { BulkActionBar } from "./BulkActionBar";

type StatusFilter = "all" | "pending" | "generated" | "emailed" | "viewed";

interface LoaStatusTableProps {
  rows: LoaStatusRow[];
  loading: boolean;
  onRefetch: () => Promise<void>;
  programId: string;
  templateId: string | null;
  onRowClick: (row: LoaStatusRow) => void;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred";
}

function StatusBadge({ status }: { status: LoaStatusRow["status"] }) {
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
  if (status === "generated") return <Badge variant="warning">Generated</Badge>;
  if (status === "emailed") return <Badge variant="info">Emailed</Badge>;
  return <Badge variant="success">Viewed</Badge>;
}

function ActionLabel({ status }: { status: LoaStatusRow["status"] }) {
  if (status === "emailed" || status === "viewed") return <>Resend</>;
  if (status === "generated") return <>Send email</>;
  return <>Send</>;
}

export function LoaStatusTable({
  rows,
  loading,
  onRefetch,
  programId,
  templateId,
  onRowClick,
}: LoaStatusTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === "" ||
        row.participantName.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [rows, statusFilter, searchQuery]);

  const allFilteredIds = useMemo(
    () => filteredRows.map((r) => r.participantId),
    [filteredRows],
  );

  const allSelected =
    allFilteredIds.length > 0 &&
    allFilteredIds.every((id) => selected.has(id));
  const someSelected =
    !allSelected && allFilteredIds.some((id) => selected.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      // Deselect all currently filtered
      setSelected((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all currently filtered
      setSelected((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleRow(participantId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  }

  async function handleSend(e: React.MouseEvent, participantId: string) {
    e.stopPropagation();
    if (!templateId) return;
    setSendingIds((prev) => new Set(prev).add(participantId));
    try {
      await sendLoa(programId, templateId, { participantId, resend: true });
      await onRefetch();
      toast.success("LoA sent");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(participantId);
        return next;
      });
    }
  }

  async function handleBulkSend() {
    if (!templateId) return;
    setBulkLoading(true);
    try {
      await sendLoa(programId, templateId, {
        participantIds: [...selected],
        resend: true,
      });
      await onRefetch();
      toast.success(`LoA sent to ${selected.size} participant(s)`);
      setSelected(new Set());
      setBulkDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBulkLoading(false);
    }
  }

  const selectionCount = selected.size;

  return (
    <div className="space-y-2">
      {/* Bulk Action Bar */}
      {selectionCount > 0 && (
        <BulkActionBar
          count={selectionCount}
          onSend={() => setBulkDialogOpen(true)}
          onClear={() => setSelected(new Set())}
        />
      )}

      <div className="rounded-xl border border-zinc-200 bg-white">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">LoA Recipients</h2>
          <button
            type="button"
            onClick={onRefetch}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 border-b border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="generated">Generated</option>
            <option value="emailed">Emailed</option>
            <option value="viewed">Viewed</option>
          </select>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <span className="whitespace-nowrap text-xs text-zinc-400">
            Showing {filteredRows.length} of {rows.length}
          </span>
        </div>

        {/* Table */}
        {filteredRows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No recipients match"
            description="Adjust filters or change the audience"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-2.5 text-left">Participant</th>
                <th className="px-4 py-2.5 text-left">Submitted</th>
                <th className="px-4 py-2.5 text-left">Doc No.</th>
                <th className="px-4 py-2.5 text-left">Generated</th>
                <th className="px-4 py-2.5 text-left">Emailed</th>
                <th className="px-4 py-2.5 text-left">Viewed</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.map((row) => {
                const isSending = sendingIds.has(row.participantId);
                const isChecked = selected.has(row.participantId);
                return (
                  <tr
                    key={row.participantId}
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => onRowClick(row)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        checked={isChecked}
                        onChange={() => toggleRow(row.participantId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{row.participantName}</div>
                      <div className="text-xs text-zinc-400">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {formatDate(row.submittedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                      {row.documentNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {formatDateTime(row.generatedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {formatDateTime(row.emailedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {formatDateTime(row.viewedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {row.fileUrl && (
                          <a
                            href={row.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            PDF
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={isSending || templateId === null}
                          onClick={(e) => void handleSend(e, row.participantId)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40"
                        >
                          {isSending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          {isSending ? "Sending…" : <ActionLabel status={row.status} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk Send Confirm Dialog */}
      <ConfirmDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        title="Send Letter of Acceptance"
        description={`Generate and send the LoA to ${selectionCount} selected participant(s)? Already-sent recipients will be re-sent.`}
        confirmLabel={`Send to ${selectionCount}`}
        variant="default"
        loading={bulkLoading}
        onConfirm={handleBulkSend}
      />
    </div>
  );
}
