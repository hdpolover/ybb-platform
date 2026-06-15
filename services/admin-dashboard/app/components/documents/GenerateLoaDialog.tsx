"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sendLoa } from "@/src/shared/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { Button } from "@/src/ui/button";

interface GenerateLoaDialogProps {
  templateId: string | null;
  programId: string;
  onSuccess: () => void;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred";
}

export function GenerateLoaDialog({ templateId, programId, onSuccess }: GenerateLoaDialogProps) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<"submitted" | "accepted">("accepted");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!templateId) return;
    setSubmitting(true);
    try {
      const result = await sendLoa(programId, templateId, { bulk: true, audience });
      toast.success(
        `Generated & sent ${result.generated} LoA(s)${result.failed ? `, ${result.failed} failed` : ""}`,
      );
      setOpen(false);
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        disabled={templateId === null}
        onClick={() => setOpen(true)}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        <Send className="h-3.5 w-3.5" />
        Generate &amp; Send
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setAudience('accepted'); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate &amp; Send LoA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-zinc-600">
              Generate LoA PDFs and email each participant. Choose the audience:
            </p>
            <div className="space-y-2">
              {(["accepted", "submitted"] as const).map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
                >
                  <input
                    type="radio"
                    name="loa-audience"
                    value={opt}
                    checked={audience === opt}
                    onChange={() => setAudience(opt)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span className="text-sm font-medium capitalize text-zinc-800">
                    {opt === "accepted" ? "Accepted applicants" : "Submitted applicants"}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={submitting}
                loading={submitting}
                onClick={() => void handleConfirm()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Confirm &amp; Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
