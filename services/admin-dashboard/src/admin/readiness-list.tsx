// services/admin-dashboard/src/admin/readiness-list.tsx
"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert } from "lucide-react";
import { StatusBadge } from "@/src/admin/status-badge";
import { EmptyState } from "@/src/admin/empty-state";
import type { ReadinessRuleResult } from "@/src/shared/api-client";

const ICONS = {
  fail: ShieldAlert,
  overridden: AlertTriangle,
  unknown: HelpCircle,
  pass: CheckCircle2,
} as const;

/**
 * The subset of a readiness row this list actually renders. Lets callers fed
 * a narrower shape — e.g. the publish-blocker modal, which only has
 * `PublishBlocker` from a 422 body, not a full `ReadinessRuleResult` — pass
 * their rows in directly instead of widening this component's types.
 */
export type ReadinessListRow = Pick<
  ReadinessRuleResult,
  "ruleId" | "status" | "title" | "symptom" | "fix" | "overrideReason"
>;

type ReadinessListProps<T extends ReadinessListRow> = {
  results: T[];
  /**
   * Optional per-row action, rendered beneath the row's icon/title/symptom/fix
   * line (e.g. the override form in the publish-blocker modal). This is the
   * single place a readiness row is laid out — anything that needs a
   * row-specific extra should hook in here rather than re-implementing the row.
   */
  renderAction?: (result: T) => ReactNode;
};

export function ReadinessList<T extends ReadinessListRow>({
  results,
  renderAction,
}: ReadinessListProps<T>) {
  const outstanding = results.filter((r) => r.status !== "pass");

  if (outstanding.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Everything configured"
        description="No outstanding readiness items for this subject."
      />
    );
  }

  return (
    <ul className="divide-y divide-zinc-200">
      {outstanding.map((result) => {
        const Icon = ICONS[result.status] ?? ShieldAlert;
        return (
          <li key={result.ruleId} className="space-y-2 py-4">
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {result.title}
                  </span>
                  <StatusBadge context="readiness" status={result.status} />
                </div>
                {/* The symptom is the point: it says what a visitor sees today,
                    not merely that a field is empty. It carries the visual
                    weight the rule title used to have. */}
                <p className="mt-1 text-base font-medium text-zinc-900">{result.symptom}</p>
                {result.overrideReason ? (
                  <p className="mt-1 text-sm text-amber-700">
                    Overridden: {result.overrideReason}
                  </p>
                ) : null}
              </div>
              <a
                href={result.fix.href}
                className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {result.fix.label}
              </a>
            </div>
            {renderAction ? <div className="pl-8">{renderAction(result)}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
