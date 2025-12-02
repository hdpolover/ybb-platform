"use client";

import React from "react";
import { ArrowTrendingUpIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/solid";

export function PaymentStatusSection() {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
          <ArrowTrendingUpIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Successful
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">9</div>
          <div className="mt-1 text-xs text-zinc-500">21.4% of transactions</div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <ClockIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Pending
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">0</div>
          <div className="mt-1 text-xs text-zinc-500">0.0% of transactions</div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <XCircleIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Cancelled / Rejected
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">33</div>
          <div className="mt-1 text-xs text-zinc-500">78.6% of transactions</div>
        </div>
      </div>
    </section>
  );
}
