"use client";

import { useRouter } from "next/navigation";
import { CreditCardIcon, CalendarDaysIcon, CheckCircleIcon } from "@heroicons/react/24/solid";

const mockPaymentDetails = {
  name: "Fully Funded Registration Fee",
  category: "Registration",
  type: "Fully Funded",
  usdAmount: 10,
  active: true,
  totalPeriods: 6,
  description: "Fully Funded Registration Fee",
};

export function PaymentPeriodsHeader({ programName }: { programName: string }) {
  const router = useRouter();

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <span className="text-sm">←</span>
            <span>Back to Payments</span>
          </button>
          <h1 className="flex items-center gap-2 text-base font-semibold text-zinc-900 md:text-lg">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <CreditCardIcon className="h-4 w-4" />
            </span>
            <span>{programName} - Manage Payment Periods</span>
          </h1>
          <p className="text-xs text-zinc-500 md:text-sm">
            Configure availability periods for this program payment option.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Payment Option
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <CreditCardIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{mockPaymentDetails.name}</div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
            <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-blue-700">
              {mockPaymentDetails.category}
            </span>
            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-emerald-700">
              {mockPaymentDetails.type}
            </span>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Status & Amount
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">${mockPaymentDetails.usdAmount.toFixed(2)}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                mockPaymentDetails.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {mockPaymentDetails.active ? "Active" : "Inactive"}
            </span>
            <span className="text-zinc-500">Total Periods: {mockPaymentDetails.totalPeriods}</span>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Description
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
              <CalendarDaysIcon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-[12px] text-zinc-700">{mockPaymentDetails.description}</p>
        </div>
      </div>
    </section>
  );
}
