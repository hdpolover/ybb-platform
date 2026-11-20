// services/admin-dashboard/app/platform/deletion-requests/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Percent, Trash2, UserX } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { Skeleton } from "@/src/ui/skeleton";
import { getDeletionInsights } from "@/src/shared/api-client";
import { DELETION_PAGE_SIZE, formatPercent, reasonLabel, type DeletionInsights } from "@/lib/deletion-insights";
import { MonthlyChart, BreakdownCard } from "./_components/DeletionCharts";
import { DeletionTable } from "./_components/DeletionTable";

// Read-only. Access is gated by app/platform/layout.tsx; the API enforces platform scope again.
export default function DeletionRequestsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DeletionInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch below
    setLoading(true);
    setError(null);
    getDeletionInsights({ status: status || undefined, page, limit: DELETION_PAGE_SIZE })
      .then((res) => {
        if (id === requestId.current) setData(res);
      })
      .catch((err: unknown) => {
        if (id === requestId.current) setError(err instanceof Error ? err.message : "Failed to load deletion requests");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [status, page]);

  const totals = data?.totals;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Account deletions"
        description="Participants who asked to delete their account, and why. Identity is hidden once an account is purged."
      />

      {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {!data && loading && <Skeleton className="h-24 w-full" />}

      {data && totals && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Total" value={totals.all.toLocaleString()} icon={Trash2} />
            <StatCard title="Last 30 days" value={totals.last30Days.toLocaleString()} icon={Clock} />
            <StatCard title="Waiting for purge" value={totals.pendingPurge.toLocaleString()} icon={Clock} />
            <StatCard title="Completed" value={totals.completed.toLocaleString()} icon={UserX} />
            <StatCard
              title="Cancelled rate"
              value={formatPercent(totals.cancellationRate)}
              description={`${totals.cancelled.toLocaleString()} cancelled`}
              icon={Percent}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <MonthlyChart data={data.monthly} className="lg:col-span-3" />
            <BreakdownCard
              title="Reasons"
              rows={data.byReason.map((r) => ({ key: r.category, label: reasonLabel(r.category), count: r.count }))}
              className="lg:col-span-2"
            />
            <BreakdownCard
              title="Brands"
              rows={data.byBrand.map((b) => ({ key: b.brandId ?? "unknown", label: b.brand ?? "Unknown brand", count: b.count }))}
            />
          </div>

          <DeletionTable
            requests={data.requests}
            status={status}
            loading={loading}
            onStatus={(s) => {
              setStatus(s);
              setPage(1);
            }}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
