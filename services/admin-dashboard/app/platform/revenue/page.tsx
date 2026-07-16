// app/platform/revenue/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { RefreshCw } from "lucide-react";
import { getPlatformRevenueStats, type PlatformRevenueStats } from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { PageHeader } from "@/src/admin/page-header";
import { Button } from "@/src/ui/button";
import { FilterSelect } from "@/src/ui/select";
import { Skeleton } from "@/src/ui/skeleton";
import { CurrencyToggle } from "@/app/components/revenue/CurrencyToggle";
import { RevenueKpiCards } from "@/app/components/revenue/RevenueKpiCards";
import { RevenueTrendChart } from "@/app/components/revenue/RevenueTrendChart";
import { RevenueBarBreakdown } from "@/app/components/revenue/RevenueBarBreakdown";
import { RevenueTransactionsTable } from "@/app/components/revenue/RevenueTransactionsTable";
import { UnbackfilledBanner } from "@/app/components/revenue/UnbackfilledBanner";
import type { CurrencyMode } from "@/app/components/revenue/revenue-format";

export default function PlatformRevenuePage() {
  const { accessiblePrograms } = useAuth();

  const brandOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of accessiblePrograms) {
      if (!seen.has(p.brandId)) seen.set(p.brandId, p.brandName);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [accessiblePrograms]);

  const [brandId, setBrandId] = useQueryState("brandId", parseAsString.withDefault("").withOptions({ clearOnDefault: true }));

  const programOptions = useMemo(
    () =>
      accessiblePrograms
        .filter((p) => !brandId || p.brandId === brandId)
        .map((p) => ({ id: p.programId, name: p.programName })),
    [accessiblePrograms, brandId],
  );

  const [stats, setStats] = useState<PlatformRevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>("IDR");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlatformRevenueStats({ brandId: brandId || undefined });
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load revenue data.");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue"
        description="Platform-wide financial overview across brands and programs"
        actions={
          <div className="flex items-center gap-2">
            <div className="w-48">
              <FilterSelect
                aria-label="Brand"
                value={brandId}
                onChange={(e) => void setBrandId(e.target.value || null)}
              >
                <option value="">All Brands</option>
                {brandOptions.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </FilterSelect>
            </div>
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
              title="Revenue by Program"
              subtitle="Gross revenue and paid count per program."
              data={stats.byProgram.map((p) => ({
                name: p.programName,
                grossIdr: p.grossIdr,
                count: p.paidCount,
              }))}
            />
            <RevenueBarBreakdown
              title="Revenue by Brand"
              subtitle="Gross revenue and paid count per brand."
              data={stats.byBrand.map((b) => ({
                name: b.brandName,
                grossIdr: b.grossIdr,
                count: b.paidCount,
              }))}
            />
          </div>
        </>
      )}

      <RevenueTransactionsTable fixedBrandId={brandId || undefined} programOptions={programOptions} />
    </div>
  );
}
