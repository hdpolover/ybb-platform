// app/programs/[programId]/revenue/page.tsx
"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getProgramRevenueStats, type ProgramRevenueStats } from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { PageHeader } from "@/src/admin/page-header";
import { Button } from "@/src/ui/button";
import { Skeleton } from "@/src/ui/skeleton";
import { CurrencyToggle } from "@/app/components/revenue/CurrencyToggle";
import { RevenueKpiCards } from "@/app/components/revenue/RevenueKpiCards";
import { RevenueTrendChart } from "@/app/components/revenue/RevenueTrendChart";
import { RevenueBarBreakdown } from "@/app/components/revenue/RevenueBarBreakdown";
import { RevenueTransactionsTable } from "@/app/components/revenue/RevenueTransactionsTable";
import { UnbackfilledBanner } from "@/app/components/revenue/UnbackfilledBanner";
import type { CurrencyMode } from "@/app/components/revenue/revenue-format";

export default function ProgramRevenuePage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms } = useAuth();

  const program = useMemo(
    () => accessiblePrograms.find((p) => p.programId === programId || p.programSlug === programId),
    [accessiblePrograms, programId],
  );
  const resolvedProgramId = program?.programId ?? programId;

  const [stats, setStats] = useState<ProgramRevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>("IDR");

  const fetchStats = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProgramRevenueStats(resolvedProgramId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load revenue data.");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue"
        description={`Financial overview${program ? ` for ${program.programName}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <CurrencyToggle value={currencyMode} onChange={setCurrencyMode} />
            <Button variant="outline" size="sm" onClick={() => void fetchStats()} disabled={loading}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {stats && (
        <>
          <UnbackfilledBanner count={stats.kpis.unbackfilledCount} />

          <RevenueKpiCards kpis={stats.kpis} currencyMode={currencyMode} />

          <RevenueTrendChart data={stats.revenueByMonth} />

          <div className="grid gap-4 lg:grid-cols-2">
            <RevenueBarBreakdown
              title="Revenue by Payment Method"
              subtitle="Gross revenue and paid count per method."
              data={stats.byPaymentMethod.map((m) => ({
                name: m.method,
                grossIdr: m.grossIdr,
                count: m.count,
              }))}
            />
            <RevenueBarBreakdown
              title="Revenue by Tier"
              subtitle="Gross revenue and paid count per pricing tier."
              data={stats.byTier.map((t) => ({
                name: t.tierName,
                grossIdr: t.grossIdr,
                count: t.count,
              }))}
            />
          </div>
        </>
      )}

      <RevenueTransactionsTable fixedProgramId={resolvedProgramId} />
    </div>
  );
}
