// services/admin-dashboard/src/admin/publish-readiness-modal.tsx
"use client";

import { useState } from "react";
import { ShieldAlert, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/ui/dialog";
import { Button } from "@/src/ui/button";
import { StatusBadge } from "@/src/admin/status-badge";
import { createReadinessOverride, type PublishBlocker } from "@/src/shared/api-client";

const ICONS = { fail: ShieldAlert, unknown: HelpCircle } as const;

const MIN_OVERRIDE_REASON_LENGTH = 10;

type PublishReadinessModalProps = {
  subjectType: "brand" | "program";
  subjectId: string;
  blockers: PublishBlocker[];
  /** Platform admins only — anyone else never sees the override affordance. */
  canOverride: boolean;
  onClose: () => void;
  /** Re-run the publish attempt after an override is saved. */
  onRetry: () => void;
};

/**
 * Shown when POST /programs/:id/publish (or the brand equivalent) returns 422.
 * Renders the blocking readiness rules from the error body rather than
 * re-fetching the readiness report, and lets a platform admin override a
 * single rule with a required reason before retrying the publish.
 */
export function PublishReadinessModal({
  subjectType,
  subjectId,
  blockers,
  canOverride,
  onClose,
  onRetry,
}: PublishReadinessModalProps) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function overrideRule(ruleId: string) {
    setSavingRuleId(ruleId);
    setError(null);
    try {
      await createReadinessOverride({
        subjectType,
        subjectId,
        ruleId,
        reason: (reasons[ruleId] ?? "").trim(),
      });
      onRetry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save override.");
    } finally {
      setSavingRuleId(null);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Not ready to publish</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-zinc-600">
          These items must be resolved before this can go live.
        </p>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <ul className="max-h-[60vh] divide-y divide-zinc-200 overflow-y-auto">
          {blockers.map((blocker) => {
            const Icon = ICONS[blocker.status] ?? ShieldAlert;
            const reason = reasons[blocker.ruleId] ?? "";
            const isSaving = savingRuleId === blocker.ruleId;
            return (
              <li key={blocker.ruleId} className="space-y-2 py-4">
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {blocker.title}
                      </span>
                      <StatusBadge context="readiness" status={blocker.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-zinc-900">{blocker.symptom}</p>
                    <a
                      href={blocker.fix.href}
                      className="mt-1 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      {blocker.fix.label}
                    </a>
                  </div>
                </div>

                {canOverride ? (
                  <div className="flex gap-2 pl-8">
                    <input
                      type="text"
                      className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      placeholder="Reason for overriding (required)"
                      value={reason}
                      onChange={(e) => setReasons({ ...reasons, [blocker.ruleId]: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      loading={isSaving}
                      disabled={isSaving || reason.trim().length < MIN_OVERRIDE_REASON_LENGTH}
                      onClick={() => overrideRule(blocker.ruleId)}
                    >
                      Override
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
