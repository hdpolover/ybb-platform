"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from "recharts";

interface NationalityDatum {
  country: string;
  count: number;
}

interface NationalitySectionProps {
  data: NationalityDatum[];
  onOpenDetails: () => void;
}

export function NationalitySection({ data, onOpenDetails }: NationalitySectionProps) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Top Nationalities
            </div>
            <p className="text-[11px] text-zinc-500">
              Negara dengan jumlah peserta terbanyak.
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

        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 40, right: 10, top: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="country"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
  );
}
