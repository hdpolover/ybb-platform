// app/programs/[programId]/analytics/_components/AnalyticsStatCard.tsx

import * as React from "react";
import type { LucideIcon } from "lucide-react";

interface AnalyticsStatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: LucideIcon;
}

/**
 * Static summary card — no hover effects per design guidelines.
 * Matches the StatCard inline style from the existing analytics overview page.
 */
export function AnalyticsStatCard({ label, value, sub, accent, icon: Icon }: AnalyticsStatCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      {Icon && (
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${accent ?? "bg-blue-50 text-blue-500"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-1.5 truncate text-2xl font-semibold text-zinc-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
      </div>
    </div>
  );
}
