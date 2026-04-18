"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart2, TrendingUp, Users, Layers } from "lucide-react";
import { getAdminAnalytics, type AdminAnalytics } from "../../../src/shared/api-client";
import { useAuth } from "../../contexts/AuthContext";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { Button } from "@/src/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";

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
    <div className="space-y-6">
      <PageHeader
        title="Platform Analytics"
        description="Comprehensive analytics and insights across all programs"
        actions={
          <Button variant="outline" size="sm" onClick={fetchAnalytics} loading={loading}>
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading && !analytics && (
        <p className="text-sm text-zinc-400">Loading analytics…</p>
      )}

      {analytics && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Total Programs"
              value={analytics.programs.total}
              description={`${analytics.programs.active} active`}
              icon={Layers}
            />
            <StatCard
              title="Total Users"
              value={analytics.users.total}
              description={`${analytics.users.new_this_month} new this month`}
              icon={Users}
            />
            <StatCard
              title="Applications"
              value={analytics.applications.total}
              description="All time"
              icon={TrendingUp}
            />
            <StatCard
              title="Participants"
              value={analytics.participants.total}
              description="Accepted"
              icon={BarChart2}
            />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Applications by Status</h2>
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-5">
              {Object.entries(analytics.applications.by_status).map(([status, count]) => (
                <div key={status} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{status}</p>
                  <p className="mt-0.5 text-lg font-bold text-zinc-900">{count as number}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Top Programs by Applicants</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead className="text-right">Applicants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.top_programs.map((p, idx) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-zinc-500">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right font-semibold">{p.applicants}</TableCell>
                  </TableRow>
                ))}
                {analytics.top_programs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-zinc-400">No data.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Program Status Breakdown</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Total", value: analytics.programs.total },
                { label: "Published", value: analytics.programs.published },
                { label: "Active", value: analytics.programs.active },
                { label: "Draft", value: analytics.programs.draft },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-[10px] font-medium text-zinc-500">{label}</p>
                  <p className="mt-0.5 text-xl font-bold text-zinc-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
