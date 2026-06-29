"use client";
// app/programs/[programId]/analytics/registrations/page.tsx

import { use, useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { AlertCircle, Calendar, Loader2, TrendingUp, Users } from "lucide-react";
import { getRegistrationsAnalytics, type RegistrationsAnalyticsResponse } from "@/src/shared/api-client";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { PageHeader } from "@/src/admin/page-header";
import { EmptyState } from "@/src/admin/empty-state";
import { AnalyticsStatCard } from "../_components/AnalyticsStatCard";
import { ChartCard } from "../_components/ChartCard";
import { PageSkeleton } from "../_components/PageSkeleton";

export default function RegistrationsAnalyticsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const resolvedId = useResolvedProgramId(programId);

  const [data, setData] = useState<RegistrationsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void getRegistrationsAnalytics(resolvedId).then((d) => {
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
        title="Registrations"
        description="Registration trend and timing analysis"
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AnalyticsStatCard
              label="Total Registrations"
              value={data.summary.total.toLocaleString()}
              icon={Users}
              accent="bg-blue-50 text-blue-500"
            />
            <AnalyticsStatCard
              label="Peak Day"
              value={data.summary.peakDay ?? "—"}
              sub={data.summary.peakDayCount > 0 ? `${data.summary.peakDayCount.toLocaleString()} registrations` : undefined}
              icon={TrendingUp}
              accent="bg-emerald-50 text-emerald-500"
            />
            <AnalyticsStatCard
              label="Avg Per Day"
              value={data.summary.avgPerDay.toFixed(1)}
              sub="registrations per active day"
              icon={Calendar}
              accent="bg-purple-50 text-purple-500"
            />
          </div>

          {/* Date range card */}
          {(data.summary.firstRegistration || data.summary.lastRegistration) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnalyticsStatCard
                label="First Registration"
                value={data.summary.firstRegistration ?? "—"}
                accent="bg-amber-50 text-amber-500"
              />
              <AnalyticsStatCard
                label="Last Registration"
                value={data.summary.lastRegistration ?? "—"}
                accent="bg-amber-50 text-amber-500"
              />
            </div>
          )}

          {/* Daily trend line chart */}
          {data.dailyTrend.length === 0 ? (
            <EmptyState title="No daily trend data yet" description="Registration timeline will appear as participants sign up." />
          ) : (
            <ChartCard title="Daily Registrations" sub="Chronological registration trend">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyTrend} margin={{ left: -20, right: 16, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.max(0, Math.floor(data.dailyTrend.length / 10) - 1)}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name="Registrations"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {/* Monthly totals bar chart */}
          {data.monthlyTotals.length > 0 && (
            <ChartCard title="Monthly Totals" sub="Registrations per month">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyTotals} margin={{ left: -20, right: 4, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Registrations" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {/* By country + by source tables */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SimpleRankTable
              title="By Country"
              rows={data.byCountry.map((r) => ({ label: r.country, count: r.count }))}
              emptyMessage="No country data yet."
            />
            <SimpleRankTable
              title="By Knowledge Source"
              rows={data.bySource.map((r) => ({ label: r.source, count: r.count }))}
              emptyMessage="No source data yet."
            />
          </div>
        </>
      )}
    </div>
  );
}

// Simple ranked list table for by-country and by-source
function SimpleRankTable({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: { label: string; count: number }[];
  emptyMessage: string;
}) {
  const max = rows[0]?.count ?? 1;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="mt-4 divide-y divide-zinc-100">
        {rows.length === 0 && (
          <p className="py-4 text-center text-xs text-zinc-400">{emptyMessage}</p>
        )}
        {rows.map((row, idx) => (
          <div key={row.label} className="flex items-center gap-3 py-2">
            <span className="w-5 shrink-0 text-center text-xs font-medium text-zinc-400">{idx + 1}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-700">{row.label}</span>
            <div className="w-24 shrink-0 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-1.5 rounded-full bg-blue-400"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-medium text-zinc-600">
              {row.count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
