"use client";
// app/programs/[programId]/analytics/gender/page.tsx

import { use, useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { AlertCircle, Loader2, Users } from "lucide-react";
import { getGenderAnalytics, type GenderAnalyticsResponse } from "@/src/shared/api-client";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { PageHeader } from "@/src/admin/page-header";
import { EmptyState } from "@/src/admin/empty-state";
import { AnalyticsStatCard } from "../_components/AnalyticsStatCard";
import { ChartCard } from "../_components/ChartCard";
import { CrossTabTable } from "../_components/CrossTabTable";
import { PageSkeleton } from "../_components/PageSkeleton";
import { PALETTE, stripNoiseBuckets } from "../_components/analytics-helpers";

export default function GenderAnalyticsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const resolvedId = useResolvedProgramId(programId);

  const [data, setData] = useState<GenderAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void getGenderAnalytics(resolvedId).then((d) => {
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
        title="Gender"
        description="Gender breakdown of participants"
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
              label="Male"
              value={`${data.summary.pctMale.toFixed(1)}%`}
              sub={`${Math.round((data.summary.pctMale / 100) * data.summary.total).toLocaleString()} participants`}
              accent="bg-blue-50 text-blue-500"
            />
            <AnalyticsStatCard
              label="Female"
              value={`${data.summary.pctFemale.toFixed(1)}%`}
              sub={`${Math.round((data.summary.pctFemale / 100) * data.summary.total).toLocaleString()} participants`}
              accent="bg-pink-50 text-pink-500"
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
            <EmptyState title="No gender data yet" description="Once participants submit profiles, the gender breakdown will appear here." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Pie */}
              <ChartCard title="Gender Distribution" sub="Excludes Not Specified and Unknown">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stripNoiseBuckets(data.distribution, "gender").map((d) => ({ name: d.gender, value: d.count }))}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        paddingAngle={2}
                        label={({ value }: { value?: number }) => {
                          const total = stripNoiseBuckets(data.distribution, "gender").reduce((s, d) => s + d.count, 0);
                          return total ? `${(((value ?? 0) / total) * 100).toFixed(0)}%` : "";
                        }}
                        labelLine={false}
                      >
                        {stripNoiseBuckets(data.distribution, "gender").map((_, idx) => (
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

              {/* Bar */}
              <ChartCard title="Count by Gender" sub="Excludes Not Specified and Unknown">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stripNoiseBuckets(data.distribution, "gender").map((d) => ({ name: d.gender, count: d.count }))}
                      margin={{ left: -20, right: 4, top: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Participants">
                        {stripNoiseBuckets(data.distribution, "gender").map((_, idx) => (
                          <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          )}

          {/* Cross-tabs */}
          <CrossTabTable data={data.genderByAge} title="Gender × Age Band" />
        </>
      )}
    </div>
  );
}
