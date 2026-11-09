// services/admin-dashboard/app/components/participants/FfResult.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import { Button } from "@/src/ui/button";
import { setApplicationsFundingDecision, type FundingDecision } from "@/src/shared/api-client";

const RESULT_BADGE: Record<FundingDecision, { label: string; className: string }> = {
  awarded: { label: "Awarded", className: "bg-emerald-50 text-emerald-700" },
  not_awarded: { label: "Not awarded", className: "bg-zinc-100 text-zinc-600" },
};

/** Result cell for a Fully Funded row; other categories have no FF result. */
export function FfResultBadge({
  category,
  decision,
}: {
  category: string;
  decision: FundingDecision | null | undefined;
}) {
  if (category !== "fully_funded" || !decision) return <span className="text-zinc-400">—</span>;
  const { label, className } = RESULT_BADGE[decision];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>{label}</span>;
}

type Choice = { decision: FundingDecision | null; label: string };

const CHOICES: Choice[] = [
  { decision: "awarded", label: "Awarded" },
  { decision: "not_awarded", label: "Not awarded" },
  { decision: null, label: "Clear" },
];

interface FfResultBulkActionProps {
  programId: string;
  selectedIds: string[];
  /** Called after a successful update so the caller can refresh and drop the selection. */
  onDone: () => void;
}

/** Bulk "Set FF result" bar shown while rows are selected. Sends no email. */
export function FfResultBulkAction({ programId, selectedIds, onDone }: FfResultBulkActionProps) {
  const [pending, setPending] = useState<Choice | null>(null);
  const count = selectedIds.length;

  async function apply() {
    if (!pending) return;
    try {
      const { updated } = await setApplicationsFundingDecision(programId, selectedIds, pending.decision);
      toast.success(
        updated === count
          ? `Updated ${updated} of ${count}`
          : `Updated ${updated} of ${count} (only submitted Fully Funded applications can get a result)`,
      );
      setPending(null);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set FF result");
    }
  }

  if (count === 0) return null;

  const who = `${count} selected applicant${count === 1 ? "" : "s"}`;
  const description =
    pending?.decision === null
      ? `Clear the FF result for ${who}? No email is sent.`
      : `Set the FF result to "${pending?.label}" for ${who}? No email is sent; email results separately.`;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
      <span className="font-semibold">{count} selected</span>
      <span className="text-blue-700">Set FF result:</span>
      {CHOICES.map((choice) => (
        <Button key={choice.label} type="button" size="sm" variant="outline" onClick={() => setPending(choice)}>
          {choice.label}
        </Button>
      ))}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={pending?.decision === null ? "Clear FF result" : "Set FF result"}
        description={description}
        confirmLabel={pending?.decision === null ? "Clear result" : "Set result"}
        variant={pending?.decision === null ? "destructive" : "default"}
        onConfirm={apply}
      />
    </div>
  );
}
