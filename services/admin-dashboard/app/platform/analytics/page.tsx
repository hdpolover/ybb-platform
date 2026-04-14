"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  RectangleStackIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { getAdminAnalytics, type AdminAnalytics } from "../../../src/shared/api-client";
import { useAuth } from "../../contexts/AuthContext";

export default function AnalyticsPage() {
  const { adminProfile } = useAuth();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const brandId = adminProfile?.assignedBrands?.[0]?.brandId ?? undefined;

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAnalytics(brandId);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Platform Analytics</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Comprehensive analytics and insights across all programs
          </p>
        </div>
        <button
          type="button"
          onClick={fetchAnalytics}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      {loading && (
        <p className="text-xs text-zinc-400">Loading analytics…</p>
      )}

      {!loading && analytics && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              icon={<RectangleStackIcon className="h-5 w-5 text-blue-600" />}
              bg="bg-blue-100"
              label="Total Programs"
              value={analytics.programs.total}
              sub={`${analytics.programs.active} active`}
            />
            <StatCard
              icon={<UsersIcon className="h-5 w-5 text-emerald-600" />}
              bg="bg-emerald-100"
              label="Total Users"
              value={analytics.users.total}
              sub={`${analytics.users.new_this_month} new this month`}
            />
            <StatCard
              icon={<ArrowTrendingUpIcon className="h-5 w-5 text-purple-600" />}
              bg="bg-purple-100"
              label="Applications"
              value={analytics.applications.total}
              sub="All time"
            />
            <StatCard
              icon={<ChartBarIcon className="h-5 w-5 text-amber-600" />}
              bg="bg-amber-100"
              label="Participants"
              value={analytics.participants.total}
              sub="Accepted"
            />
          </div>

          <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Applications by Status</h2>
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-5">
              {Object.entries(analytics.applications.by_status).map(([status, count]) => (
                <div key={status} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{status}</p>
                  <p className="mt-0.5 text-lg font-bold text-zinc-900">{count as number}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Top Programs by Applicants</h2>
            <div className="overflow-hidden rounded-md border border-zinc-200">
              <table className="min-w-full text-left text-[11px]">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Program</th>
                    <th className="px-3 py-2 text-right font-semibold">Applicants</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.top_programs.map((p, idx) => (
                    <tr key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/60"}>
                      <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{p.name}</td>
                      <td className="px-3 py-2 text-right font-semibold text-zinc-700">{p.applicants}</td>
                    </tr>
                  ))}
                  {analytics.top_programs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-zinc-400">No data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Program Status Breakdown</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              <MiniStat label="Total" value={analytics.programs.total} />
              <MiniStat label="Published" value={analytics.programs.published} />
              <MiniStat label="Active" value={analytics.programs.active} />
              <MiniStat label="Draft" value={analytics.programs.draft} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  bg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-600">{label}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
          <p className="mt-1 text-[10px] text-zinc-500">{sub}</p>
        </div>
        <div className={`rounded-full ${bg} p-2.5`}>{icon}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
      <p className="text-[10px] font-medium text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}
