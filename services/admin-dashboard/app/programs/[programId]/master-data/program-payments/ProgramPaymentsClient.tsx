"use client";

import { useState, useEffect, useCallback } from "react";
import { ProgramPaymentsTable } from "@/app/components/programPaymentsMasterData/options/PaymentOptionTable";
import type { PaymentOptionRow } from "@/app/components/programPaymentsMasterData/options/PaymentOptionTable";
import { getPricingTiers } from "@/app/platform/api";
import type { PricingTier } from "@/app/platform/api";

function tierToRow(tier: PricingTier, index: number): PaymentOptionRow {
  const now = new Date();
  const activePeriod = tier.validityPeriods.find(
    (vp) => new Date(vp.startDate) <= now && now <= new Date(vp.endDate),
  );
  const upcomingPeriod = tier.validityPeriods.find(
    (vp) => new Date(vp.startDate) > now,
  );

  const fmtRange = (start: string, end: string) =>
    `${new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} - ${new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  const category =
    tier.feeType === "registration_fee"
      ? ("Registration Fee" as const)
      : tier.name.toLowerCase().includes("2")
        ? ("Program Fee 2" as const)
        : ("Program Fee 1" as const);

  const fundingType = (() => {
    const cats = (tier.allowedCategories ?? []).map((c) => c.toLowerCase());
    if (cats.includes("self_funded") && cats.includes("fully_funded")) return "All" as const;
    if (cats.includes("fully_funded")) return "Fully Funded" as const;
    return "Self Funded" as const;
  })();

  return {
    id: index + 1,
    _id: tier.id,
    optionName: tier.name,
    category,
    fundingType,
    amountUsd: tier.price,
    amountIdrApprox: `Approx. Rp ${(tier.price * 16900).toLocaleString("id-ID")}`,
    currentActivePeriodLabel: activePeriod ? "Active Period" : null,
    currentActivePeriodRange: activePeriod ? fmtRange(activePeriod.startDate, activePeriod.endDate) : null,
    currentActiveStatusBadge: activePeriod ? "Active Now" : null,
    lastActivePeriodLabel: upcomingPeriod ? "Next Period" : null,
    lastActivePeriodRange: upcomingPeriod ? fmtRange(upcomingPeriod.startDate, upcomingPeriod.endDate) : null,
    lastActiveStatusBadge: upcomingPeriod ? "Upcoming" : null,
    status: tier.isActive ? "Active" : "Inactive",
    description: tier.description ?? "",
    benefits: tier.benefits ?? [],
    requirements: tier.requirements ?? [],
  };
}

export function ProgramPaymentsClient({
  programId,
  programName,
}: {
  programId: string;
  programName: string;
}) {
  const [rows, setRows] = useState<PaymentOptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tiers = await getPricingTiers(programId);
      setRows(tiers.map((t, i) => tierToRow(t, i)));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.optionName.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.fundingType.toLowerCase().includes(q)
    );
  });

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <span>Master Data</span>
            </div>
            <h1 className="mt-1 text-lg font-bold text-zinc-900">
              {programName} Program Payments
            </h1>
            <p className="text-sm text-zinc-500">
              Manage registration and program fee payment options, along with their active periods.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-400">Loading payment options…</div>
        ) : (
          <ProgramPaymentsTable
            data={filtered}
            currentSearch={search}
            onRefresh={load}
            programId={programId}
          />
        )}
      </section>
    </main>
  );
}
