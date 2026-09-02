// app/components/reminders/ReminderDeliveryDialog.tsx
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
import { formatWib } from "./wib-time";
import type {
  ParticipantReminderDetail,
  ParticipantReminderRecipientSend,
} from "@/src/shared/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReminderDeliveryDialogProps {
  delivery: ParticipantReminderDetail;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<
  ParticipantReminderRecipientSend["status"],
  "success" | "destructive" | "secondary"
> = {
  sent: "success",
  failed: "destructive",
  pending: "secondary",
};

const STATUS_LABEL: Record<ParticipantReminderRecipientSend["status"], string> = {
  sent: "Sent",
  failed: "Failed",
  pending: "Pending",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReminderDeliveryDialog({
  delivery,
  onClose,
}: ReminderDeliveryDialogProps) {
  const { summary, recipients } = delivery;
  // Failures first — they are the only rows anyone opens this dialog to act on.
  const ordered = [...recipients].sort(
    (a, b) => Number(b.status === "failed") - Number(a.status === "failed"),
  );

  const dispatchedToNobody =
    !delivery.hasSendLog && delivery.audienceCount === 0 && delivery.sentAt !== null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Email delivery — {delivery.subject}</DialogTitle>
          <DialogDescription>
            Who this reminder was sent to when it went out at{" "}
            {formatWib(delivery.sentAt ?? delivery.dispatchedAt)}.
          </DialogDescription>
        </DialogHeader>

        {dispatchedToNobody ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Nobody owed the registration fee when this reminder came due, so no email
            was sent. That is a completed run, not a failed one.
          </p>
        ) : !delivery.hasSendLog ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No delivery records for this reminder yet. If it has not reached its send
            time, this is expected — it has not fanned out.
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
                        {recipient.sentAt ? formatWib(recipient.sentAt) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[16rem] text-sm text-zinc-500">
                        {recipient.errorMessage ? (
                          <span className="text-red-700">{recipient.errorMessage}</span>
                        ) : (
                          (recipient.providerMessageId ?? "—")
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
