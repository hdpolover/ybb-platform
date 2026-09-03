"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart2, TrendingUp, Users, Layers, Download } from "lucide-react";
import {
  getAdminAnalytics,
  exportUsersExcel,
  exportParticipantsExcel,
  exportPaymentsExcel,
  exportAuditLogsExcel,
  type AdminAnalytics,
} from "../../../src/shared/api-client";
import { useAuth } from "../../contexts/AuthContext";
import { useAccessibleBrands } from "../../hooks/useAccessibleBrands";
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
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Same derivation as platform/users so the three platform pages cannot
  // disagree about which brands this admin has. No picker here yet; this at
  // least means a programme-scoped admin resolves a brand at all.
  const brandId = useAccessibleBrands()[0]?.brandId ?? undefined;

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

  const handleExport = async (id: string, fn: () => Promise<void>) => {
    setExportingId(id);
    setExportError(null);
    try {
      await fn();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingId(null);
    }
  };

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

      {exportError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Export failed: {exportError}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-zinc-700">Export Reports</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "users", label: "Users", fn: exportUsersExcel },
            { id: "participants", label: "Participants", fn: exportParticipantsExcel },
            { id: "payments", label: "Payments", fn: exportPaymentsExcel },
            { id: "audit-logs", label: "Audit Logs", fn: exportAuditLogsExcel },
          ].map(({ id, label, fn }) => (
            <Button
              key={id}
              variant="outline"
              size="sm"
              onClick={() => void handleExport(id, fn)}
              disabled={exportingId !== null}
              loading={exportingId === id}
            >
              <Download className="h-3.5 w-3.5" />
              {exportingId === id ? "Exporting…" : `Export ${label}`}
            </Button>
          ))}
        </div>
      </div>

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
