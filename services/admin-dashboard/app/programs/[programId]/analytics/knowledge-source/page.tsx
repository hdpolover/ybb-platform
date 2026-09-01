"use client";
// app/programs/[programId]/analytics/knowledge-source/page.tsx

import { use, useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Signal, Users } from "lucide-react";
import { getKnowledgeSourceAnalytics, type KnowledgeSourceAnalyticsResponse, type SourceAccountBreakdown } from "@/src/shared/api-client";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { PageHeader } from "@/src/admin/page-header";
import { EmptyState } from "@/src/admin/empty-state";
import { AnalyticsStatCard } from "../_components/AnalyticsStatCard";
import { ChartCard } from "../_components/ChartCard";
import { CrossTabTable } from "../_components/CrossTabTable";
import { PageSkeleton } from "../_components/PageSkeleton";
import { PALETTE, stripNoiseBuckets } from "../_components/analytics-helpers";

export default function KnowledgeSourceAnalyticsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const resolvedId = useResolvedProgramId(programId);

  const [data, setData] = useState<KnowledgeSourceAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void getKnowledgeSourceAnalytics(resolvedId).then((d) => {
      if (mounted) { setData(d); setLoading(false); }
    }).catch((err: unknown) => {
      if (mounted) {
        setError(err instanceof Error ? err.message : "Failed to load analytics.");
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [resolvedId]);

  // Fetch-on-mount/resolvedId-change: `load`'s identity only changes when
  // resolvedId changes; its internal setLoading/setError/setData aren't part
  // of that dependency, so this can't loop.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => load(), [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Source"
        description="How participants heard about this program"
      />

      {loading && !data && <PageSkeleton />}

      {loading && data && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Updating…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsStatCard
              label="Total Participants"
              value={data.summary.total.toLocaleString()}
              icon={Users}
              accent="bg-blue-50 text-blue-500"
            />
            <AnalyticsStatCard
              label="Known Source"
              value={data.summary.withKnownSource.toLocaleString()}
              sub={data.summary.total > 0 ? `${((data.summary.withKnownSource / data.summary.total) * 100).toFixed(1)}% of total` : undefined}
              icon={Signal}
              accent="bg-emerald-50 text-emerald-500"
            />
            <AnalyticsStatCard
              label="Top Channel"
              value={data.summary.topChannel ?? "—"}
              sub={data.summary.topChannelPct != null ? `${data.summary.topChannelPct.toFixed(1)}% of known` : undefined}
              accent="bg-purple-50 text-purple-500"
            />
            <AnalyticsStatCard
              label="Not Specified"
              value={`${data.summary.pctNotSpecified.toFixed(1)}%`}
              sub="of total participants"
              accent="bg-zinc-100 text-zinc-500"
            />
          </div>

          {/* Charts */}
          {data.distribution.length === 0 ? (
            <EmptyState title="No distribution data yet" description="Once participants submit, their knowledge source breakdown will appear here." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Donut */}
              <ChartCard title="Source Distribution" sub="Excludes Not Specified and Unknown">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stripNoiseBuckets(data.distribution, "source").map((d) => ({ name: d.source, value: d.count }))}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        label={({ value }: { value?: number }) => {
                          const total = stripNoiseBuckets(data.distribution, "source").reduce((s, d) => s + d.count, 0);
                          return total ? `${(((value ?? 0) / total) * 100).toFixed(0)}%` : "";
                        }}
                        labelLine={false}
                      >
                        {stripNoiseBuckets(data.distribution, "source").map((_, idx) => (
                          <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(v) => <span className="text-[11px] text-zinc-600">{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* Horizontal bar */}
              <ChartCard title="Count by Source" sub="Excludes Not Specified and Unknown">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stripNoiseBuckets(data.distribution, "source").map((d) => ({ name: d.source, count: d.count }))}
                      layout="vertical"
                      margin={{ left: 60, right: 16, top: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Participants" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          )}

          {/* Accounts by Source */}
          {data.accountsBySource.length > 0 && (
            <AccountsBySourceSection
              accountsBySource={data.accountsBySource}
              distribution={data.distribution}
            />
          )}

          {/* Cross-tab */}
          <CrossTabTable data={data.countryBySource} title="Country x Source" />
        </>
      )}
    </div>
  );
}

// ── Accounts by Source section ─────────────────────────────────────────────────

function AccountsBySourceSection({
  accountsBySource,
  distribution,
}: {
  accountsBySource: SourceAccountBreakdown[];
  distribution: { source: string; count: number }[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalBySource = new Map(distribution.map((d) => [d.source, d.count]));

  function toggle(source: string) {
    setExpanded((prev) => (prev === source ? null : source));
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Accounts by Source
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-400">
          Account or person names participants entered, grouped by channel
        </p>
      </div>

      <ul className="divide-y divide-zinc-100">
        {accountsBySource.map((item) => {
          const isOpen = expanded === item.source;
          const total = totalBySource.get(item.source) ?? 0;
          const namedCount = item.accounts
            .filter((a) => a.name !== null)
            .reduce((s, a) => s + a.count, 0);

          return (
            <li key={item.source}>
              <button
                type="button"
                onClick={() => toggle(item.source)}
                className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-800">{item.source}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                    {namedCount} named / {total} total
                  </span>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-zinc-100 bg-zinc-50 px-4 pb-3 pt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="pb-1.5 pr-4 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                          Account / Person
                        </th>
                        <th className="pb-1.5 text-right text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {item.accounts.map((account, idx) => (
                        <tr key={idx} className={account.name === null ? "opacity-60" : undefined}>
                          <td className="py-1.5 pr-4">
                            {account.name === null ? (
                              <span className="italic text-zinc-400">(unnamed)</span>
                            ) : (
                              <span className="text-zinc-700">{account.name}</span>
                            )}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-zinc-600">
                            {account.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
