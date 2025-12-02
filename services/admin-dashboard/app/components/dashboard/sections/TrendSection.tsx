"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type TrendRange = "daily" | "weekly" | "monthly";

interface TrendSectionProps {
  trendRange: TrendRange;
  onChangeTrendRange: (range: TrendRange) => void;
  data: { label: string; registrations: number }[];
}

export function TrendSection({ trendRange, onChangeTrendRange, data }: TrendSectionProps) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Daily Registration Trend
          </div>
          <p className="text-[11px] text-zinc-500">
            Performa pendaftaran untuk program ini.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-[11px] text-zinc-600">
          {(["daily", "weekly", "monthly"] as TrendRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onChangeTrendRange(range)}
              className={`rounded-full px-2 py-0.5 capitalize transition ${
                trendRange === range
                  ? "bg-blue-600 text-white shadow-sm"
                  : "hover:bg-white"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -20, right: 10, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
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
            <Tooltip
              cursor={{ stroke: "#bfdbfe", strokeWidth: 1 }}
              contentStyle={{ fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="registrations"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
