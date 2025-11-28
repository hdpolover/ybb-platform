"use client";

import React from "react";

export function StatsCards() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-[13px] font-medium text-zinc-500">Total Users</div>
        <div className="mt-2 text-[22px] font-semibold text-zinc-900">1,240</div>
        <div className="mt-1 text-[12px] text-emerald-600">
          +12% dibanding minggu lalu
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-[13px] font-medium text-zinc-500">
          Active Subscriptions
        </div>
        <div className="mt-2 text-[22px] font-semibold text-zinc-900">320</div>
        <div className="mt-1 text-[12px] text-zinc-500">
          Data contoh (hardcoded)
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
        <div className="text-[13px] font-medium text-zinc-500">
          Revenue (bulan ini)
        </div>
        <div className="mt-2 text-[22px] font-semibold text-zinc-900">
          Rp 42.500.000
        </div>
        <div className="mt-1 text-[12px] text-zinc-500">
          Angka ini hanya placeholder untuk layout.
        </div>
      </div>
    </section>
  );
}
