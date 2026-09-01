// app/components/documents/LoaDeliveryDialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { Badge } from "@/src/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { formatDate } from "@/lib/utils";
import type {
  LoaBatch,
  LoaBatchRecipientSends,
  LoaRecipientSend,
} from "@/src/shared/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoaDeliveryDialogProps {
  batch: LoaBatch;
  delivery: LoaBatchRecipientSends;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<LoaRecipientSend["status"], "success" | "destructive" | "secondary"> = {
  sent: "success",
  failed: "destructive",
  pending: "secondary",
};

const STATUS_LABEL: Record<LoaRecipientSend["status"], string> = {
  sent: "Sent",
  failed: "Failed",
  pending: "Pending",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function LoaDeliveryDialog({ batch, delivery, onClose }: LoaDeliveryDialogProps) {
  const { summary, recipients } = delivery;
  // Failures first — they are the only rows anyone opens this dialog to act on.
  const ordered = [...recipients].sort(
    (a, b) => Number(b.status === "failed") - Number(a.status === "failed"),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Email delivery — {batch.name}</DialogTitle>
          <DialogDescription>
            Who was sent the &ldquo;your Invitation Letter is ready&rdquo; email when this
            batch was released.
          </DialogDescription>
        </DialogHeader>

        {!delivery.hasSendLog ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No delivery records for this batch. Batches released before per-recipient
            logging existed have no history — this is not the same as &ldquo;nobody was
            emailed&rdquo;.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-4 text-sm">
              <span className="tabular-nums text-emerald-700">{summary.sent} sent</span>
              <span className="tabular-nums text-red-700">{summary.failed} failed</span>
              {summary.pending > 0 && (
                <span className="tabular-nums text-zinc-500">
                  {summary.pending} awaiting confirmation
                </span>
              )}
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordered.map((recipient) => (
                    <TableRow key={recipient.participantId}>
                      <TableCell className="font-medium">
                        {recipient.participantName}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {recipient.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[recipient.status]}>
                          {STATUS_LABEL[recipient.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {recipient.sentAt ? formatDate(recipient.sentAt) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[16rem] text-sm text-zinc-500">
                        {recipient.errorMessage ? (
                          <span className="text-red-700">{recipient.errorMessage}</span>
                        ) : (
                          recipient.providerMessageId ?? "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
