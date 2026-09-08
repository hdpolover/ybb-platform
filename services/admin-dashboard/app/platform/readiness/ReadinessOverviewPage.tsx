// services/admin-dashboard/app/platform/readiness/ReadinessOverviewPage.tsx
"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { EmptyState } from "@/src/admin/empty-state";
import { Card } from "@/src/ui/card";
import { getReadinessSummary } from "@/src/shared/api-client";
import { summarize, staleness, type ReadinessSummaryRow } from "@/lib/readiness-summary";

export default function ReadinessOverviewPage() {
  const [rows, setRows] = useState<ReadinessSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReadinessSummary()
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((err: Error) => { if (!cancelled) setPageError(err.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const stats = summarize(rows);
  // Worst first: a fleet board sorted any other way buries the thing you opened it for.
  const sorted = [...rows].sort(
    (a, b) => b.blockerCount - a.blockerCount || b.warningCount - a.warningCount,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publish readiness"
        description="What is unconfigured across brands and published programs."
      />

      {pageError ? (
        // An API failure must never render as an empty, "all clear" board. Skip
        // the stats and table entirely rather than showing zeros next to a
        // banner nobody reads.
        <Card className="flex items-start gap-3 border-red-200 bg-red-50 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-red-800">Could not load readiness data</p>
            <p className="mt-0.5 text-sm text-red-700">{pageError}</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard title="Subjects with blockers" value={String(stats.subjectsWithBlockers)} />
            <StatCard title="Subjects clear" value={String(stats.subjectsClear)} />
            <StatCard title="Total blockers" value={String(stats.totalBlockers)} />
            <StatCard title="Total warnings" value={String(stats.totalWarnings)} />
          </div>

          {!isLoading && sorted.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nothing evaluated yet"
              description="Readiness snapshots appear after the nightly run, or when a brand or program page is opened."
            />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 text-left text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Blockers</th>
                    <th className="px-4 py-3 font-medium">Warnings</th>
                    <th className="px-4 py-3 font-medium">Last checked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {sorted.map((row) => (
                    <tr key={`${row.subjectType}:${row.subjectId}`}>
                      <td className="px-4 py-3">
                        <a
                          className="font-medium text-blue-600 hover:text-blue-700"
                          href={row.subjectType === "brand"
                            ? `/platform/brands/${row.subjectId}`
                            : `/programs/${row.subjectId}/settings/main-configuration`}
                        >
                          {row.subjectName ?? `${row.subjectType} ${row.subjectId.slice(0, 8)}`}
                          {row.subjectType === "program" && row.brandName ? (
                            <span className="ml-1 font-normal text-zinc-400">· {row.brandName}</span>
                          ) : null}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{row.blockerCount}</td>
                      <td className="px-4 py-3 text-zinc-600">{row.warningCount}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(row.evaluatedAt).toLocaleString()}
                        {staleness(row.evaluatedAt) === "stale" ? " (stale)" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
