"use client";

import { useState, useEffect, useCallback } from "react";
import { PaymentPeriodsHeader } from "@/app/components/programPaymentsMasterData/periods/PaymentPeriodsHeader";
import type { PaymentTierDetail } from "@/app/components/programPaymentsMasterData/periods/PaymentPeriodsHeader";
import { PaymentPeriodsTable } from "@/app/components/programPaymentsMasterData/periods/PaymentPeriodsTable";
import type { PeriodRow } from "@/app/components/programPaymentsMasterData/periods/PaymentPeriodsTable";
import { getPricingTierById } from "@/app/platform/api";
import type { ValidityPeriod, PricingTier } from "@/app/platform/api";

function parseDateLike(value: string | null | undefined): Date | null {
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const trimmed = value.trim();
  const normalized = trimmed
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1");
  const withTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const fallback = new Date(withTimezone);

  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function fmt(date: string | null | undefined) {
  const parsed = parseDateLike(date);
  if (!parsed) return "—";

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function periodToRow(vp: ValidityPeriod, index: number): PeriodRow {
  const now = new Date();
  const start = parseDateLike(vp.startDate);
  const end = parseDateLike(vp.endDate);
  const isActive = Boolean(start && end && start <= now && now <= end);
  const isUpcoming = Boolean(start && start > now);

  return {
    id: vp.id,
    name: vp.description ?? `Period ${index + 1}`,
    base: index === 0,
    typeLabel: index === 0 ? "Base Period" : "Continuation",
    description: vp.description ?? "",
    start: fmt(vp.startDate),
    end: fmt(vp.endDate),
    startRaw: vp.startDate ?? "",
    endRaw: vp.endDate ?? "",
    order: index + 1,
    status: isActive ? "Active" : "Inactive",
    isUpcoming,
    fromParentInfo: index > 0 ? `Extension starts: ${fmt(vp.startDate)}` : undefined,
  };
}

function tierToDetail(tier: PricingTier): PaymentTierDetail {
  const feeCategory =
    tier.feeType === "registration_fee" ? "Registration" : "Program Fee";
  const fundingType = (() => {
    const cats = (tier.allowedCategories ?? []).map((c) => c.toLowerCase());
    if (cats.includes("self_funded") && cats.includes("fully_funded")) return "All";
    if (cats.includes("fully_funded")) return "Fully Funded";
    return "Self Funded";
  })();

  return {
    name: tier.name,
    category: feeCategory,
    type: fundingType,
    usdAmount: tier.price,
    active: tier.isActive,
    totalPeriods: tier.validityPeriods.length,
    description: tier.description ?? "No description provided.",
  };
}

export function PeriodPageClient({
  programName,
  tierId,
}: {
  programName: string;
  tierId: string;
}) {
  const [tierDetail, setTierDetail] = useState<PaymentTierDetail | undefined>(undefined);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tier = await getPricingTierById(tierId);
      if (tier) {
        setTierDetail(tierToDetail(tier));
        setPeriods(tier.validityPeriods.map((vp, i) => periodToRow(vp, i)));
      }
    } catch {
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }, [tierId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PaymentPeriodsHeader programName={programName} tierDetail={tierDetail} />
      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-400 shadow-sm">
          Loading periods…
        </div>
      ) : (
        <PaymentPeriodsTable data={periods} tierId={tierId} onRefresh={load} />
      )}
    </div>
  );
}
