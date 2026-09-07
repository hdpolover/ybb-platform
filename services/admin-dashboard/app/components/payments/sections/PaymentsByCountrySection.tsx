"use client";
// app/components/payments/sections/PaymentsByCountrySection.tsx
//
// Ranked "which country do payments come from" chart for the payments
// dashboard. Modeled on the nationality analytics horizontal bar chart
// (app/programs/[programId]/analytics/nationality/page.tsx) so it reads as
// native to the product instead of a bolted-on widget.

import { AlertCircle, Globe, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import type { PaymentsByCountryResponse } from "@/src/shared/api-client";
import { EmptyState } from "@/src/admin/empty-state";
import { ChartCard } from "@/app/programs/[programId]/analytics/_components/ChartCard";
import { PALETTE } from "@/app/programs/[programId]/analytics/_components/analytics-helpers";

interface PaymentsByCountrySectionProps {
  data: PaymentsByCountryResponse | null;
  loading: boolean;
  error: string | null;
}

export function PaymentsByCountrySection({ data, loading, error }: PaymentsByCountrySectionProps) {
  if (loading && !data) {
    return (
      <ChartCard title="Payments by Country" sub="Ranked by paid invoices">
        <div className="flex h-64 animate-pulse items-center justify-center rounded bg-zinc-50 text-xs text-zinc-400">
          Loading…
        </div>
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard title="Payments by Country" sub="Ranked by paid invoices">
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      </ChartCard>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <ChartCard title="Payments by Country" sub="Ranked by paid invoices">
        <EmptyState
          icon={Globe}
          title="No paid invoices yet"
          description="Once payments come in, their country breakdown will appear here."
          className="py-10"
        />
      </ChartCard>
    );
  }

  // Ranked most-first, chart data already sorted by paidCount desc from the API.
  const bars = data.data.map((row) => ({
    name: row.country,
    count: row.paidCount,
  }));
  const pctUnknown = data.totalPaidCount > 0 ? (data.unknownCount / data.totalPaidCount) * 100 : 0;

  return (
    <ChartCard
      title="Payments by Country"
      sub={`Ranked by paid invoices${data.unknownCount > 0 ? ` — ${data.unknownCount} unattributed (${pctUnknown.toFixed(1)}%)` : ""}`}
    >
      {loading && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Updating…
        </div>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} layout="vertical" margin={{ left: 80, right: 16, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(value: number) => [`${value} paid`, "Invoices"]} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Paid invoices">
              {bars.map((bar, idx) => (
                // Unknown gets a neutral gray, not a ranked palette color, so
                // it visually reads as "unattributed" rather than a real country.
                <Cell key={idx} fill={bar.name === "Unknown" ? "#a1a1aa" : PALETTE[idx % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
