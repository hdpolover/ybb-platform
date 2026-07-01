// app/components/revenue/RevenueBarBreakdown.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatMoney } from "./revenue-format";

export interface RevenueBarBreakdownEntry {
  name: string;
  grossIdr: number;
  count: number;
}

interface RevenueBarBreakdownProps {
  title: string;
  subtitle?: string;
  data: RevenueBarBreakdownEntry[];
}

const BAR_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#db2777", "#65a30d"];

/**
 * Horizontal bar breakdown — used for byPaymentMethod/byTier (program page)
 * and byProgram/byBrand (platform page). Horizontal bars handle longer
 * category labels (program/brand names) better than a pie chart.
 */
export function RevenueBarBreakdown({ title, subtitle, data }: RevenueBarBreakdownProps) {
  const sorted = [...data].sort((a, b) => b.grossIdr - a.grossIdr);
  const height = Math.max(160, sorted.length * 40);

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</div>
        {subtitle && <p className="text-[11px] text-zinc-500">{subtitle}</p>}
      </div>

      {sorted.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-zinc-400">No data yet.</div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) =>
                  new Intl.NumberFormat("id-ID", { notation: "compact" }).format(value)
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                width={110}
              />
              <Tooltip
                cursor={{ fill: "#f4f4f5" }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7" }}
                formatter={(value, _name, item) => [
                  formatMoney(Number(value), "IDR"),
                  `Gross (${(item.payload as RevenueBarBreakdownEntry).count} paid)`,
                ]}
              />
              <Bar dataKey="grossIdr" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {sorted.map((entry, index) => (
                  <Cell key={entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
