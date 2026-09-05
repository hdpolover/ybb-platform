"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import {
  getLoaBatches,
  getLoaBatchRecipientSends,
  releaseLoaBatch,
  unreleaseLoaBatch,
  deleteLoaBatch,
  type LoaBatch,
  type LoaBatchRecipientSends,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/src/ui/tooltip";
import { EmptyState } from "@/src/admin/empty-state";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { LoaBatchDialog } from "./LoaBatchDialog";
import { LoaDeliveryDialog } from "./LoaDeliveryDialog";
import { LoaCoverageWarning } from "./LoaCoverageWarning";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoaBatchesTabProps {
  programId: string;
  /**
   * Whether the program has an ACTIVE letter_of_acceptance template.
   * `null` while unknown/loading — the Release action is only blocked once
   * this resolves to `false`, to avoid flashing a disabled state.
   */
  hasActiveTemplate?: boolean | null;
  /** Reports the latest batch list up to the parent (e.g. for a status banner). */
  onBatchesChange?: (batches: LoaBatch[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred";
}

// ─── Sub-component: Batch Row ─────────────────────────────────────────────────

interface BatchRowProps {
  batch: LoaBatch;
  /** Undefined while delivery data is still loading, or if it failed to load. */
  delivery?: LoaBatchRecipientSends;
  onEdit: (batch: LoaBatch) => void;
  onDeleteRequest: (batch: LoaBatch) => void;
  onToggleRelease: (batch: LoaBatch) => void;
  onViewDelivery: (batch: LoaBatch) => void;
  toggling: boolean;
  hasActiveTemplate?: boolean | null;
}

/**
 * Email delivery for one batch: "N sent / M failed" once outcomes have been
 * reported, or an explicit "not recorded" for batches released before
 * per-recipient logging existed. Deliberately never renders a bare "0 sent"
 * for a missing log — that would read as a failed release rather than as
 * missing history.
 */
function DeliveryCell({
  batch,
  delivery,
  onViewDelivery,
}: Pick<BatchRowProps, "batch" | "delivery" | "onViewDelivery">) {
  if (!batch.releasedAt) {
    return <span className="text-sm text-zinc-400">—</span>;
  }
  if (!delivery) {
    return <span className="text-sm text-zinc-400">…</span>;
  }
  if (!delivery.hasSendLog) {
    return (
      <button
        type="button"
        onClick={() => onViewDelivery(batch)}
        className="cursor-pointer text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
      >
        Not recorded
      </button>
    );
  }

  const { sent, failed } = delivery.summary;
  return (
    <button
      type="button"
      onClick={() => onViewDelivery(batch)}
      className="cursor-pointer text-sm underline underline-offset-2"
    >
      <span className="tabular-nums text-emerald-700">{sent} sent</span>
      {failed > 0 && (
        <span className="tabular-nums text-red-700"> / {failed} failed</span>
      )}
    </button>
  );
}

function BatchRow({
  batch,
  delivery,
  onEdit,
  onDeleteRequest,
  onToggleRelease,
  onViewDelivery,
  toggling,
  hasActiveTemplate,
}: BatchRowProps) {
  const isReleased = !!batch.releasedAt;
  // Only block once we positively know there's no active template — `null`
  // (still loading) must not flash a disabled button.
  const blockRelease = !isReleased && hasActiveTemplate === false;

  const releaseButton = (
    <Button
      size="sm"
      variant={isReleased ? "outline" : "default"}
      onClick={() => onToggleRelease(batch)}
      loading={toggling}
      disabled={toggling || blockRelease}
      className="min-w-[90px]"
    >
      {isReleased ? "Unrelease" : "Release"}
    </Button>
  );

  return (
    <TableRow>
      <TableCell className="font-medium">{batch.name}</TableCell>
      <TableCell className="text-sm text-zinc-500">
        {formatDate(batch.paymentFrom)} – {formatDate(batch.paymentTo)}
      </TableCell>
      <TableCell className="tabular-nums">{batch.eligibleCount}</TableCell>
      <TableCell className="tabular-nums">{batch.downloadedCount}</TableCell>
      <TableCell>
        <DeliveryCell
          batch={batch}
          delivery={delivery}
          onViewDelivery={onViewDelivery}
        />
      </TableCell>
      <TableCell>
        <Badge variant={isReleased ? "success" : "secondary"}>
          {isReleased ? "Released" : "Draft"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {blockRelease ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{releaseButton}</span>
              </TooltipTrigger>
              <TooltipContent>Publish an Invitation Letter template first.</TooltipContent>
            </Tooltip>
          ) : (
            releaseButton
          )}
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

export function LoaBatchesTab({ programId, hasActiveTemplate = null, onBatchesChange }: LoaBatchesTabProps) {
  const resolvedProgramId = useResolvedProgramId(programId);
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

  // Per-batch email delivery, keyed by batch id. Fetched alongside the batch
  // list so the table can show "N sent / M failed" without a second click.
  const [deliveries, setDeliveries] = useState<Record<string, LoaBatchRecipientSends>>({});
  const [deliveryTarget, setDeliveryTarget] = useState<LoaBatch | null>(null);

  /**
   * Delivery data is fetched per batch and folded in as it arrives, in
   * parallel and deliberately after the table has already rendered: it is
   * supplementary, so a slow or failing delivery query must never block or
   * fail the batch list itself. A batch whose fetch rejects simply keeps no
   * entry and renders as still-loading rather than as an error.
   */
  const fetchDeliveries = useCallback(
    async (programId: string, forBatches: LoaBatch[]) => {
      const settled = await Promise.allSettled(
        forBatches.map((batch) => getLoaBatchRecipientSends(programId, batch.id)),
      );

      setDeliveries(
        settled.reduce<Record<string, LoaBatchRecipientSends>>(
          (byBatchId, result) =>
            result.status === "fulfilled"
              ? { ...byBatchId, [result.value.batchId]: result.value }
              : byBatchId,
          {},
        ),
      );
    },
    [],
  );

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLoaBatches(resolvedProgramId);
      setBatches(data);
      onBatchesChange?.(data);
      void fetchDeliveries(resolvedProgramId, data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId, onBatchesChange, fetchDeliveries]);

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
      await deleteLoaBatch(resolvedProgramId, deleteTarget.id);
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
    // Defense in depth: the Release button is disabled in this state too,
    // but guard the handler directly in case of a stale/race click.
    if (!batch.releasedAt && hasActiveTemplate === false) {
      toast.error("Publish an Invitation Letter template before releasing a batch.");
      return;
    }
    setTogglingId(batch.id);
    try {
      if (batch.releasedAt) {
        await unreleaseLoaBatch(resolvedProgramId, batch.id);
        toast.success(`Batch "${batch.name}" is now a draft.`);
      } else {
        await releaseLoaBatch(resolvedProgramId, batch.id);
        if (hasActiveTemplate) {
          toast.success(`Batch "${batch.name}" released. Eligible participants can now download their Invitation Letter.`);
        } else {
          // hasActiveTemplate is still unresolved (null) — release went through,
          // but we can't yet confirm participants can actually download.
          toast.warning(`Batch "${batch.name}" released. Confirm a template is published so participants can download.`);
        }
      }
      void fetchBatches();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // uncovered* is program-scoped, not batch-scoped — every delivery response
  // carries the same figures, so the first one that loaded is as good as any.
  const coverage = Object.values(deliveries)[0];

  return (
    <div className="space-y-4 pt-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Manage release batches to control which participants can download their Invitation Letter.
        </p>
        <Button size="sm" onClick={handleNewBatch}>
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          New Batch
        </Button>
      </div>

      {/* Silent-exclusion blind spot: applicants no released batch covers */}
      {!loading && !error && coverage && (
        <LoaCoverageWarning
          count={coverage.uncoveredParticipantCount}
          participants={coverage.uncoveredParticipants}
          coveredByUnreleasedBatchCount={coverage.coveredByUnreleasedBatchCount}
          unreleasedBatchNames={coverage.unreleasedBatchNames}
        />
      )}

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
          description="Create a batch to define a payment date window and release Invitation Letters for eligible participants."
          action={{ label: "Create First Batch", onClick: handleNewBatch }}
        />
      )}

      {/* Batch table */}
      {!loading && !error && batches.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Payment Range</TableHead>
              <TableHead>Eligible</TableHead>
              <TableHead>Downloaded</TableHead>
              <TableHead>Email Delivery</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <BatchRow
                key={batch.id}
                batch={batch}
                delivery={deliveries[batch.id]}
                onEdit={handleEdit}
                onDeleteRequest={handleDeleteRequest}
                onToggleRelease={handleToggleRelease}
                onViewDelivery={setDeliveryTarget}
                toggling={togglingId === batch.id}
                hasActiveTemplate={hasActiveTemplate}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <LoaBatchDialog
          programId={resolvedProgramId}
          batch={editingBatch}
          onClose={handleDialogClose}
          onSaved={handleSaved}
        />
      )}

      {/* Per-recipient delivery dialog */}
      {deliveryTarget && deliveries[deliveryTarget.id] && (
        <LoaDeliveryDialog
          batch={deliveryTarget}
          delivery={deliveries[deliveryTarget.id]}
          onClose={() => setDeliveryTarget(null)}
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
        description="This will permanently remove the batch. Participants already in this batch will lose their Invitation Letter access if no other released batch covers them."
        confirmLabel="Delete Batch"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
