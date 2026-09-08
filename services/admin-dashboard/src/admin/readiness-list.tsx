// services/admin-dashboard/src/admin/readiness-list.tsx
"use client";

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

export function ReadinessList({ results }: { results: ReadinessRuleResult[] }) {
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
        const Icon = ICONS[result.status];
        return (
          <li key={result.ruleId} className="flex items-start gap-3 py-4">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900">{result.title}</span>
                <StatusBadge context="readiness" status={result.status} />
              </div>
              {/* The symptom is the point: it says what a visitor sees today,
                  not merely that a field is empty. */}
              <p className="mt-1 text-sm text-zinc-600">{result.symptom}</p>
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
          </li>
        );
      })}
    </ul>
  );
}
