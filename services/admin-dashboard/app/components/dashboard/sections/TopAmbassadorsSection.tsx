"use client";

import React from "react";

interface AmbassadorDatum {
  name: string;
  country: string;
  referrals: number;
}

interface TopAmbassadorsSectionProps {
  data: AmbassadorDatum[];
  onOpenDetails: () => void;
}

export function TopAmbassadorsSection({ data, onOpenDetails }: TopAmbassadorsSectionProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Top Ambassadors
          </div>
          <p className="text-[11px] text-zinc-500">
            Ambassador dengan jumlah referal terbanyak.
          </p>
        </div>
        <button
          type="button"
          className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
          onClick={onOpenDetails}
        >
          View all
        </button>
      </div>

      <div className="mt-2 overflow-hidden rounded-md border border-zinc-200">
        <table className="min-w-full border-collapse text-left text-[11px]">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Nationality</th>
              <th className="px-3 py-2 text-right font-semibold">Referrals</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((amb, index) => (
              <tr
                key={amb.name}
                className={index % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}
              >
                <td className="px-3 py-1.5 text-zinc-800">{amb.name}</td>
                <td className="px-3 py-1.5 text-zinc-700">{amb.country}</td>
                <td className="px-3 py-1.5 text-right text-zinc-700">
                  {amb.referrals}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
