// services/admin-dashboard/app/platform/deletion-requests/_components/DeletionCharts.tsx
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { monthLabel } from "@/lib/deletion-insights";

const PANEL = "rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-sm";

export function MonthlyChart({ data, className }: { data: { month: string; count: number }[]; className?: string }) {
  const rows = data.map((d) => ({ label: monthLabel(d.month), count: d.count }));
  return (
    <section className={cn(PANEL, className)}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Requests per month</h2>
      <div className="mt-2 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: -20, right: 10, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip cursor={{ fill: "#eff6ff" }} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="count" name="Requests" fill="#2563eb" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type BreakdownRow = { key: string; label: string; count: number };

/** Horizontal bars as plain divs: a short ranked list reads better than an axis chart. */
export function BreakdownCard({ title, rows, className }: { title: string; rows: BreakdownRow[]; className?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className={cn(PANEL, className)}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h2>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="text-xs">
            <div className="mb-0.5 flex justify-between gap-2 text-zinc-700">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-zinc-500">{r.count.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-100">
              <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
