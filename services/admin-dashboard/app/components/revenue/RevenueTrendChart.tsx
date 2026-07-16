// app/components/revenue/RevenueTrendChart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { RevenueMonthPoint } from "@/src/shared/api-client";
import { formatMoney } from "./revenue-format";

interface RevenueTrendChartProps {
  data: RevenueMonthPoint[];
}

/**
 * Gross vs. net vs. (estimated) fee over time. `revenueByMonth` only carries
 * IDR figures from the API, so this chart always renders in IDR regardless
 * of the page's IDR/USD toggle.
 */
export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Revenue Trend
        </div>
        <p className="text-[11px] text-zinc-500">
          Gross, net, and estimated fee by month (IDR).
        </p>
      </div>

      <div className="mt-2 h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            No revenue data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: -10, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) =>
                  new Intl.NumberFormat("id-ID", { notation: "compact" }).format(value)
                }
                width={48}
              />
              <Tooltip
                cursor={{ stroke: "#bfdbfe", strokeWidth: 1 }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e4e4e7" }}
                formatter={(value) => formatMoney(Number(value), "IDR")}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="grossIdr"
                name="Gross"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="netIdr"
                name="Net (est.)"
                stroke="#059669"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="feeIdr"
                name="Fee (est.)"
                stroke="#d97706"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
