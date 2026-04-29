"use client";

import { useState, useEffect, useCallback } from "react";
import { ProgramPaymentsTable } from "@/app/components/programPaymentsMasterData/options/PaymentOptionTable";
import type { PaymentOptionRow } from "@/app/components/programPaymentsMasterData/options/PaymentOptionTable";
import { getPricingTiers } from "@/app/platform/api";
import type { PricingTier } from "@/app/platform/api";

function parseDateLike(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const dateFromNumber = new Date(value);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }

  if (typeof value !== "string") {
    return null;
  }

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

function tierToRow(tier: PricingTier, index: number): PaymentOptionRow {
  const now = new Date();
  const periodBounds = (tier.validityPeriods ?? []).map((vp) => ({
    period: vp,
    start: parseDateLike(vp.startDate),
    end: parseDateLike(vp.endDate),
  }));
  const activePeriod = periodBounds.find(
    ({ start, end }) => Boolean(start && end && start <= now && now <= end),
  )?.period;
  const upcomingPeriod = periodBounds.find(
    ({ start }) => Boolean(start && start > now),
  )?.period;

  const fmtRange = (start: unknown, end: unknown) => {
    const startDate = parseDateLike(start);
    const endDate = parseDateLike(end);
    if (!startDate || !endDate) return "—";
    return `${startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} - ${endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  };

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
  const [search] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tiers = await getPricingTiers(programId);
      setRows(tiers.map((t, i) => tierToRow(t, i)));
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load payment options. Please try again.",
      );
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
        {error ? (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
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
