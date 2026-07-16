// app/components/revenue/RevenueKpiCards.tsx
import { DollarSign, Receipt, TrendingUp, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/src/admin/stat-card";
import type { RevenueKpis } from "@/src/shared/api-client";
import { formatMoney, type CurrencyMode } from "./revenue-format";

interface RevenueKpiCardsProps {
  kpis: RevenueKpis;
  currencyMode: CurrencyMode;
}

/**
 * Gross / estimated fee / estimated net / collection rate KPI row. Fee and
 * net are config-based estimates (not settled merchant discount rate figures
 * from the payment gateway) — always labeled "Est." with an explanatory
 * caption so admins don't mistake them for reconciled gateway numbers.
 *
 * There is no `feeUsd` in the KPI payload — when toggled to USD the fee card
 * shows "N/A" rather than fabricating a value.
 */
export function RevenueKpiCards({ kpis, currencyMode }: RevenueKpiCardsProps) {
  const gross = currencyMode === "IDR" ? kpis.grossIdr : kpis.grossUsd;
  const net = currencyMode === "IDR" ? kpis.netIdr : kpis.netUsd;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Gross Revenue"
        value={formatMoney(gross, currencyMode)}
        description={`${kpis.paidCount} paid invoice${kpis.paidCount !== 1 ? "s" : ""}`}
        icon={DollarSign}
      />
      <StatCard
        title="Est. Gateway Fee"
        value={currencyMode === "IDR" ? formatMoney(kpis.feeIdr, "IDR") : "N/A"}
        description="Config-based estimate, not settled MDR"
        icon={Receipt}
      />
      <StatCard
        title="Est. Net Revenue"
        value={formatMoney(net, currencyMode)}
        description="Gross minus estimated fee"
        icon={TrendingUp}
      />
      <StatCard
        title="Collection Rate"
        value={`${kpis.collectionRate.toFixed(1)}%`}
        description={`${kpis.failedCount} failed, ${kpis.cancelledCount} cancelled`}
        icon={CheckCircle2}
      />
    </div>
  );
}
