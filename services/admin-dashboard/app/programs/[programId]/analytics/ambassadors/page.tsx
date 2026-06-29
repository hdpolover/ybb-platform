"use client";
// app/programs/[programId]/analytics/ambassadors/page.tsx

import { use, useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertCircle, Loader2, Star, TrendingUp, Users } from "lucide-react";
import { getAmbassadorsAnalytics, type AmbassadorsAnalyticsResponse } from "@/src/shared/api-client";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { PageHeader } from "@/src/admin/page-header";
import { EmptyState } from "@/src/admin/empty-state";
import { AnalyticsStatCard } from "../_components/AnalyticsStatCard";
import { ChartCard } from "../_components/ChartCard";
import { PageSkeleton } from "../_components/PageSkeleton";
import { PALETTE } from "../_components/analytics-helpers";

export default function AmbassadorsAnalyticsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const resolvedId = useResolvedProgramId(programId);

  const [data, setData] = useState<AmbassadorsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void getAmbassadorsAnalytics(resolvedId).then((d) => {
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
        title="Ambassadors"
        description="Ambassador program performance and leaderboard"
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
              label="Total Ambassadors"
              value={data.summary.totalAmbassadors.toLocaleString()}
              icon={Users}
              accent="bg-blue-50 text-blue-500"
            />
            <AnalyticsStatCard
              label="Total Referred"
              value={data.summary.totalReferred.toLocaleString()}
              sub="participants via ambassadors"
              icon={TrendingUp}
              accent="bg-emerald-50 text-emerald-500"
            />
            <AnalyticsStatCard
              label="Avg Referrals"
              value={data.summary.avgReferrals.toFixed(1)}
              sub="per ambassador"
              accent="bg-purple-50 text-purple-500"
            />
            <AnalyticsStatCard
              label="Top Ambassador"
              value={data.summary.topAmbassador?.name ?? "—"}
              sub={data.summary.topAmbassador ? `${data.summary.topAmbassador.count.toLocaleString()} referrals` : undefined}
              icon={Star}
              accent="bg-amber-50 text-amber-500"
            />
          </div>

          {/* Bar chart — top 10 by total referrals */}
          {data.leaderboard.length === 0 ? (
            <EmptyState title="No ambassador data yet" description="Once ambassadors make referrals, the leaderboard will appear here." />
          ) : (
            <ChartCard title="Top Ambassadors by Referrals" sub="Total vs Successful — top 10">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.leaderboard.slice(0, 10).map((a) => ({
                      name: a.name.length > 15 ? `${a.name.slice(0, 14)}…` : a.name,
                      total: a.totalReferrals,
                      successful: a.successfulReferrals,
                    }))}
                    margin={{ left: -20, right: 4, top: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="total" fill={PALETTE[0]} radius={[4, 4, 0, 0]} name="Total Referrals" />
                    <Bar dataKey="successful" fill={PALETTE[1]} radius={[4, 4, 0, 0]} name="Successful" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {/* Full leaderboard table */}
          {data.leaderboard.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Full Leaderboard</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Rank</th>
                      <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Name</th>
                      <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Total Referrals</th>
                      <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Successful</th>
                      <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.leaderboard.map((amb, idx) => {
                      const rate = amb.totalReferrals > 0
                        ? ((amb.successfulReferrals / amb.totalReferrals) * 100).toFixed(1)
                        : "0.0";
                      return (
                        <tr key={amb.name} className="hover:bg-zinc-50/50">
                          <td className="px-3 py-2 font-medium text-zinc-400">
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                          </td>
                          <td className="px-3 py-2 font-medium text-zinc-700">{amb.name}</td>
                          <td className="px-3 py-2 text-right text-zinc-600">{amb.totalReferrals.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-emerald-600">{amb.successfulReferrals.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-zinc-500">{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
