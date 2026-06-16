"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import {
  getLoaBatches,
  releaseLoaBatch,
  unreleaseLoaBatch,
  deleteLoaBatch,
  type LoaBatch,
} from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/src/ui/badge";
import { Button } from "@/src/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { EmptyState } from "@/src/admin/empty-state";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { LoaBatchDialog } from "./LoaBatchDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoaBatchesTabProps {
  programId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred";
}

// ─── Sub-component: Batch Row ─────────────────────────────────────────────────

interface BatchRowProps {
  batch: LoaBatch;
  onEdit: (batch: LoaBatch) => void;
  onDeleteRequest: (batch: LoaBatch) => void;
  onToggleRelease: (batch: LoaBatch) => void;
  toggling: boolean;
}

function BatchRow({
  batch,
  onEdit,
  onDeleteRequest,
  onToggleRelease,
  toggling,
}: BatchRowProps) {
  const isReleased = !!batch.releasedAt;

  return (
    <TableRow>
      <TableCell className="font-medium">{batch.name}</TableCell>
      <TableCell className="text-sm text-zinc-500">
        {formatDate(batch.submissionFrom)} – {formatDate(batch.submissionTo)}
      </TableCell>
      <TableCell className="tabular-nums">{batch.eligibleCount}</TableCell>
      <TableCell className="tabular-nums">{batch.downloadedCount}</TableCell>
      <TableCell>
        <Badge variant={isReleased ? "success" : "secondary"}>
          {isReleased ? "Released" : "Draft"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isReleased ? "outline" : "default"}
            onClick={() => onToggleRelease(batch)}
            loading={toggling}
            disabled={toggling}
            className="min-w-[90px]"
          >
            {isReleased ? "Unrelease" : "Release"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(batch)}
            disabled={toggling}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDeleteRequest(batch)}
            disabled={toggling}
          >
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LoaBatchesTab({ programId }: LoaBatchesTabProps) {
  const [batches, setBatches] = useState<LoaBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<LoaBatch | undefined>(undefined);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<LoaBatch | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Per-row toggle loading
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLoaBatches(programId);
      setBatches(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void fetchBatches();
  }, [fetchBatches]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleNewBatch() {
    setEditingBatch(undefined);
    setDialogOpen(true);
  }

  function handleEdit(batch: LoaBatch) {
    setEditingBatch(batch);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingBatch(undefined);
  }

  function handleSaved() {
    setDialogOpen(false);
    setEditingBatch(undefined);
    void fetchBatches();
  }

  function handleDeleteRequest(batch: LoaBatch) {
    setDeleteTarget(batch);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLoaBatch(programId, deleteTarget.id);
      toast.success(`Batch "${deleteTarget.name}" deleted.`);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      void fetchBatches();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleRelease(batch: LoaBatch) {
    setTogglingId(batch.id);
    try {
      if (batch.releasedAt) {
        await unreleaseLoaBatch(programId, batch.id);
        toast.success(`Batch "${batch.name}" is now a draft.`);
      } else {
        await releaseLoaBatch(programId, batch.id);
        toast.success(`Batch "${batch.name}" released. Eligible participants can now download their LOA.`);
      }
      void fetchBatches();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pt-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Manage release batches to control which participants can download their LOA.
        </p>
        <Button size="sm" onClick={handleNewBatch}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          New Batch
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <span className="text-sm text-zinc-400">Loading batches…</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void fetchBatches()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && batches.length === 0 && (
        <EmptyState
          icon={CalendarRange}
          title="No release batches yet"
          description="Create a batch to define a submission date window and release LOAs for eligible participants."
          action={{ label: "Create First Batch", onClick: handleNewBatch }}
        />
      )}

      {/* Batch table */}
      {!loading && !error && batches.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Submission Range</TableHead>
              <TableHead>Eligible</TableHead>
              <TableHead>Downloaded</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <BatchRow
                key={batch.id}
                batch={batch}
                onEdit={handleEdit}
                onDeleteRequest={handleDeleteRequest}
                onToggleRelease={handleToggleRelease}
                toggling={togglingId === batch.id}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <LoaBatchDialog
          programId={programId}
          batch={editingBatch}
          onClose={handleDialogClose}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
          }
        }}
        title={`Delete "${deleteTarget?.name ?? "batch"}"?`}
        description="This will permanently remove the batch. Participants already in this batch will lose their LOA access if no other released batch covers them."
        confirmLabel="Delete Batch"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
