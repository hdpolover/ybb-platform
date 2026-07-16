"use client";

import React from "react";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";

interface AgeDatum {
  range: string;
  count: number;
}

interface AgeSectionProps {
  data: AgeDatum[];
  onOpenDetails: () => void;
}

export function AgeSection({ data, onOpenDetails }: AgeSectionProps) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Age Distribution
            </div>
            <p className="text-[11px] text-zinc-500">
              Sebaran usia peserta program.
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
            <BarChart data={data} margin={{ left: -20, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="range"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickCount={5}
              />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
  );
}
