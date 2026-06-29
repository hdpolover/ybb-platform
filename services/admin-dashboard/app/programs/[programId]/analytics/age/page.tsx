"use client";
// app/programs/[programId]/analytics/age/page.tsx

import { use, useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { AlertCircle, Clock, Loader2, Users } from "lucide-react";
import { getAgeAnalytics, type AgeAnalyticsResponse } from "@/src/shared/api-client";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { PageHeader } from "@/src/admin/page-header";
import { EmptyState } from "@/src/admin/empty-state";
import { AnalyticsStatCard } from "../_components/AnalyticsStatCard";
import { ChartCard } from "../_components/ChartCard";
import { CrossTabTable } from "../_components/CrossTabTable";
import { PageSkeleton } from "../_components/PageSkeleton";
import { PALETTE, stripNoiseBuckets } from "../_components/analytics-helpers";

export default function AgeAnalyticsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const resolvedId = useResolvedProgramId(programId);

  const [data, setData] = useState<AgeAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void getAgeAnalytics(resolvedId).then((d) => {
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
        title="Age"
        description="Age band breakdown of participants"
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
              label="Dominant Age Band"
              value={data.summary.dominantBand ?? "—"}
              sub={data.summary.dominantBandPct != null ? `${data.summary.dominantBandPct.toFixed(1)}% of total` : undefined}
              icon={Clock}
              accent="bg-purple-50 text-purple-500"
            />
            <AnalyticsStatCard
              label="Active Bands"
              value={data.summary.activeBands.toLocaleString()}
              sub="distinct age ranges represented"
              accent="bg-emerald-50 text-emerald-500"
            />
            <AnalyticsStatCard
              label="Age Unknown"
              value={`${data.summary.pctUnknown.toFixed(1)}%`}
              sub="of total participants"
              accent="bg-zinc-100 text-zinc-500"
            />
          </div>

          {/* Age bar chart */}
          {data.distribution.length === 0 ? (
            <EmptyState title="No age data yet" description="Once participants register with their birth date, age band distribution will appear here." />
          ) : (
            <ChartCard title="Distribution by Age Band" sub="Excludes Unknown">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stripNoiseBuckets(data.distribution, "band").map((d) => ({ name: d.band, count: d.count }))}
                    margin={{ left: -20, right: 4, top: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Participants">
                      {stripNoiseBuckets(data.distribution, "band").map((_, idx) => (
                        <Cell key={idx} fill={PALETTE[(idx + 3) % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {/* Cross-tabs */}
          <CrossTabTable data={data.ageByNationality} title="Age Band × Nationality" />
        </>
      )}
    </div>
  );
}
