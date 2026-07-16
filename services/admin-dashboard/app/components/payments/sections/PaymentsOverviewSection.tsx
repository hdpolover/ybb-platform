import React from "react";
import { BanknotesIcon } from "@heroicons/react/24/solid";

export function PaymentsOverviewSection() {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Payments Overview</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Ringkasan transaksi pembayaran untuk program yang dipilih.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <BanknotesIcon className="h-5 w-5 text-emerald-500" />
          <span>Total Payments</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Total Amount
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">
            IDR 1.521.000
          </div>
          <div className="mt-1 text-xs text-zinc-500">From 42 transactions</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Total in IDR
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">Rp 1.521.000</div>
          <div className="mt-1 text-xs text-zinc-500">Converted total in local currency</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Total in USD
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">$ 0.00</div>
          <div className="mt-1 text-xs text-zinc-500">Converted total in USD</div>
        </div>
      </div>
    </section>
  );
}
