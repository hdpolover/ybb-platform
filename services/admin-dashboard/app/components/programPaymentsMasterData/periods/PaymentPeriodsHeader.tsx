"use client";

import { useRouter } from "next/navigation";
import { CreditCardIcon, CalendarDaysIcon, CheckCircleIcon } from "@heroicons/react/24/solid";

export interface PaymentTierDetail {
  name: string;
  category: string;
  type: string;
  usdAmount: number;
  active: boolean;
  totalPeriods: number;
  description: string;
}

export function PaymentPeriodsHeader({
  programName,
  tierDetail,
}: {
  programName: string;
  tierDetail?: PaymentTierDetail;
}) {
  const router = useRouter();
  const details = tierDetail ?? {
    name: "—",
    category: "—",
    type: "—",
    usdAmount: 0,
    active: false,
    totalPeriods: 0,
    description: "Loading…",
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
            <span>← Back to Payments</span>
          </button>
          <h1 className="mt-2 flex items-center gap-2 text-lg font-bold text-zinc-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <CreditCardIcon className="h-5 w-5" />
            </span>
            <span>{programName} - Payment Periods</span>
          </h1>
          <p className="text-sm text-zinc-500">Configure availability periods for this payment option.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Payment Option</div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <CreditCardIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-sm font-semibold text-zinc-900">{details.name}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">{details.category}</span>
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">{details.type}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status & Amount</div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-sm font-semibold text-zinc-900">${details.usdAmount.toFixed(2)}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${details.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
              {details.active ? "Active" : "Inactive"}
            </span>
            <span className="text-xs font-medium text-zinc-500">Total Periods: {details.totalPeriods}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Description</div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
              <CalendarDaysIcon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-700 leading-relaxed">{details.description}</p>
        </div>
      </div>
    </section>
  );
}