"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { sendLoa, type LoaStatusRow } from "@/src/shared/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { Badge } from "@/src/ui/badge";
import { Button } from "@/src/ui/button";
import { formatDate } from "@/lib/utils";

interface LoaRecipientDrawerProps {
  row: LoaStatusRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendSuccess: () => Promise<void>;
  programId: string;
  templateId: string | null;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred";
}

interface TimelineStep {
  label: string;
  timestamp: string | null;
}

function TimelineItem({ label, timestamp }: TimelineStep) {
  const done = timestamp !== null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4 text-zinc-300" />
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? "text-zinc-800" : "text-zinc-400"}`}>
          {label}
        </p>
        <p className="text-xs text-zinc-400">{timestamp ? formatDate(timestamp) : "—"}</p>
      </div>
    </div>
  );
}

export function LoaRecipientDrawer({
  row,
  open,
  onOpenChange,
  onSendSuccess,
  programId,
  templateId,
}: LoaRecipientDrawerProps) {
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!row || !templateId) return;
    setSending(true);
    try {
      await sendLoa(programId, templateId, { participantId: row.participantId, resend: true });
      await onSendSuccess();
      toast.success(
        row.status === "pending" || row.status === "generated"
          ? "LoA sent successfully"
          : "LoA re-sent successfully",
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const sendLabel =
    row?.status === "emailed" || row?.status === "viewed" ? "Resend" : "Send";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md">
        {/* Header */}
        <SheetHeader className="pb-4 border-b border-zinc-100">
          <SheetTitle>{row?.participantName ?? "—"}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-zinc-500">{row?.email}</span>
            {row && (
              <Badge variant={row.applicationStatus === "accepted" ? "success" : "info"}>
                {row.applicationStatus === "accepted" ? "Accepted" : "Submitted"}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Document number */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 mb-1">
              Document Number
            </p>
            {row?.documentNumber ? (
              <p className="font-mono text-sm text-zinc-800">{row.documentNumber}</p>
            ) : (
              <p className="text-sm text-zinc-400 italic">Not generated yet</p>
            )}
          </div>

          {/* Timeline */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 mb-3">
              Timeline
            </p>
            <div className="space-y-4 pl-1">
              <TimelineItem label="Generated" timestamp={row?.generatedAt ?? null} />
              <TimelineItem label="Emailed" timestamp={row?.emailedAt ?? null} />
              <TimelineItem label="Viewed" timestamp={row?.viewedAt ?? null} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 pt-4 space-y-2">
          {row?.fileUrl && (
            <a
              href={row.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <ExternalLink className="h-4 w-4" />
              View PDF
            </a>
          )}
          <Button
            className="w-full"
            disabled={sending || templateId === null}
            loading={sending}
            onClick={() => void handleSend()}
          >
            {sending ? "Sending…" : sendLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
