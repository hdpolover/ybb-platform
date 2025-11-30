"use client";

import React from "react";
import { BanknotesIcon } from "@heroicons/react/24/solid";

export function PaymentBreakdownSection() {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-6 py-5 text-sm shadow-sm">
      <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
        <BanknotesIcon className="h-4 w-4 text-emerald-500" />
        Payment Breakdown
      </h2>

      <div className="rounded-md border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-700 md:text-sm">
        <div className="flex items-center justify-between py-1.5">
          <div>
            <div className="font-medium text-zinc-800">Base Program Fee</div>
            <div className="text-[11px] text-zinc-500">
              Official program registration fee before any discount.
            </div>
          </div>
          <div className="text-sm font-semibold text-zinc-900">Rp 3.500.000</div>
        </div>

        <div className="flex items-center justify-between border-t border-dashed border-zinc-200 py-1.5">
          <div>
            <div className="font-medium text-zinc-800">Scholarship / Discount</div>
            <div className="text-[11px] text-zinc-500">
              Fully funded scholarship applied for this participant.
            </div>
          </div>
          <div className="text-sm font-semibold text-emerald-600">- Rp 3.331.000</div>
        </div>

        <div className="flex items-center justify-between border-t border-dashed border-zinc-200 py-1.5">
          <div>
            <div className="font-medium text-zinc-800">Payment Gateway Fee</div>
            <div className="text-[11px] text-zinc-500">
              Processing fee for Debit/Credit Card via Midtrans.
            </div>
          </div>
          <div className="text-sm font-semibold text-zinc-900">Rp 0</div>
        </div>

        <div className="mt-2 border-t border-zinc-200 pt-2">
          <div className="flex items-center justify-between text-sm font-semibold text-zinc-900">
            <span>Total Paid</span>
            <span>Rp 169.000</span>
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            * All amounts are displayed in Indonesian Rupiah (IDR) based on the final transaction.
          </div>
        </div>
      </div>
    </section>
  );
}
