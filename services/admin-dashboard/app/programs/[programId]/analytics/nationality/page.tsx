"use client";
// app/programs/[programId]/analytics/nationality/page.tsx

import { use, useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { AlertCircle, Globe, Loader2, Users } from "lucide-react";
import { getNationalityAnalytics, type NationalityAnalyticsResponse } from "@/src/shared/api-client";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { PageHeader } from "@/src/admin/page-header";
import { EmptyState } from "@/src/admin/empty-state";
import { AnalyticsStatCard } from "../_components/AnalyticsStatCard";
import { ChartCard } from "../_components/ChartCard";
import { CrossTabTable } from "../_components/CrossTabTable";
import { PageSkeleton } from "../_components/PageSkeleton";
import { PALETTE, stripNoiseBuckets } from "../_components/analytics-helpers";

export default function NationalityAnalyticsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const resolvedId = useResolvedProgramId(programId);

  const [data, setData] = useState<NationalityAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void getNationalityAnalytics(resolvedId).then((d) => {
      if (mounted) { setData(d); setLoading(false); }
    }).catch((err: unknown) => {
      if (mounted) {
        setError(err instanceof Error ? err.message : "Failed to load analytics.");
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [resolvedId]);

  useEffect(() => load(), [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nationality"
        description="Geographic distribution of participants"
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
              label="Distinct Countries"
              value={data.summary.distinctCountries.toLocaleString()}
              icon={Globe}
              accent="bg-emerald-50 text-emerald-500"
            />
            <AnalyticsStatCard
              label="Top Country"
              value={data.summary.topCountry ?? "—"}
              sub={data.summary.topCountryPct != null ? `${data.summary.topCountryPct.toFixed(1)}% of total` : undefined}
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
            <EmptyState title="No nationality data yet" description="Once participants register, their nationality distribution will appear here." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Donut — top 8 */}
              <ChartCard title="Top Countries (Donut)" sub="Top 8 by count — excludes Not Specified">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stripNoiseBuckets(data.distribution, "country")
                          .slice(0, 8)
                          .map((d) => ({ name: d.country, value: d.count }))}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        label={({ value }: { value?: number }) => {
                          const cleaned = stripNoiseBuckets(data.distribution, "country");
                          const total = cleaned.reduce((s, d) => s + d.count, 0);
                          return total ? `${(((value ?? 0) / total) * 100).toFixed(0)}%` : "";
                        }}
                        labelLine={false}
                      >
                        {stripNoiseBuckets(data.distribution, "country").slice(0, 8).map((_, idx) => (
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

              {/* Horizontal bar — top 10 */}
              <ChartCard title="Top 10 Countries" sub="Excludes Not Specified">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stripNoiseBuckets(data.distribution, "country")
                        .slice(0, 10)
                        .map((d) => ({ name: d.country, count: d.count }))}
                      layout="vertical"
                      margin={{ left: 60, right: 16, top: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Participants" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          )}

          {/* Cross-tabs */}
          <CrossTabTable data={data.countryByGender} title="Country × Gender" />
        </>
      )}
    </div>
  );
}
