// services/admin-dashboard/src/admin/publish-readiness-modal.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/ui/dialog";
import { Button } from "@/src/ui/button";
import { ReadinessList } from "@/src/admin/readiness-list";
import { ApiError, createReadinessOverride, type PublishBlocker } from "@/src/shared/api-client";

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
 * re-fetching the readiness report, reusing ReadinessList for the row markup
 * so there is exactly one place that defines what a readiness row looks like.
 * Lets a platform admin override a single "fail" rule with a required reason
 * before retrying the publish. A rule whose status is "unknown" (its
 * evaluation threw, e.g. a dependent service is unreachable) never gets an
 * override affordance — overriding it can't change the outcome, since the
 * engine assigns "unknown" before an override is ever considered.
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
      if (err instanceof ApiError && err.status === 403) {
        setError("You do not have permission to override this rule. It requires super admin access.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to save override.");
      }
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

        <div className="max-h-[60vh] overflow-y-auto">
          {blockers.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Publishing was refused, but no specific blocking rule was returned. This usually
              means a rule could not be evaluated. Check the program&apos;s readiness panel for
              the full picture.
            </p>
          ) : (
          <ReadinessList
            results={blockers}
            renderAction={(blocker) => {
              if (blocker.status === "unknown") {
                return (
                  <p className="text-sm text-zinc-500">
                    This rule could not be evaluated right now — for example because a dependent
                    service is unreachable. It cannot be overridden. Publishing will be possible
                    once it can be evaluated.
                  </p>
                );
              }

              if (!canOverride) return null;

              const reason = reasons[blocker.ruleId] ?? "";
              const isSaving = savingRuleId === blocker.ruleId;
              return (
                <div className="flex gap-2">
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
              );
            }}
          />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
