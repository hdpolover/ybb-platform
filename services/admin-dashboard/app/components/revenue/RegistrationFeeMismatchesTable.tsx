// app/components/revenue/RegistrationFeeMismatchesTable.tsx
"use client";

import type { RegistrationFeeMismatchRow } from "@/src/shared/api-client";

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatCategory(category: string): string {
  return category === "fully_funded" ? "Fully Funded" : category === "self_funded" ? "Self Funded" : category;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

interface RegistrationFeeMismatchesTableProps {
  rows: RegistrationFeeMismatchRow[];
  total: number;
}

/**
 * Reconciliation listing for applications whose paid/processing registration
 * fee invoice was issued under a category (fully_funded/self_funded) that no
 * longer matches where the application sits today. Read-only: switching
 * category deliberately leaves the invoice untouched, so finance settles the
 * difference manually — this table just surfaces who needs it.
 */
export function RegistrationFeeMismatchesTable({ rows, total }: RegistrationFeeMismatchesTableProps) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-900">Registration Fee Mismatches</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Applications whose registration fee was paid under a category (Fully Funded / Self Funded) that no
          longer matches their current one — the invoice is left untouched when an admin moves a category, so
          these need manual reconciliation. {total} {total === 1 ? "case" : "cases"}.
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3 font-semibold">Participant</th>
                <th className="px-4 py-3 font-semibold">Paid For</th>
                <th className="px-4 py-3 font-semibold">Now In</th>
                <th className="px-4 py-3 font-semibold">Invoice</th>
                <th className="px-4 py-3 font-semibold">Amount Paid</th>
                <th className="px-4 py-3 font-semibold">Current Tier Price</th>
                <th className="px-4 py-3 font-semibold">Difference</th>
                <th className="px-4 py-3 font-semibold">Paid On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-zinc-500">
                    <div className="inline-flex flex-col items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        ✓
                      </span>
                      <span className="font-semibold text-zinc-900">All registration fees reconciled</span>
                      <span className="text-xs text-zinc-500">
                        No paid or processing invoice is out of step with its application&apos;s current category.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.applicationId} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-900">{row.participantFullName || "—"}</span>
                        <span className="text-xs text-zinc-500">{row.participantEmail ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-medium text-zinc-700">
                      {formatCategory(row.invoicedCategory)}
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-medium text-zinc-700">
                      {formatCategory(row.currentCategory)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col">
                        <span className="font-mono text-[11px] text-zinc-500">{row.invoiceId}</span>
                        <span className="text-xs text-zinc-500 capitalize">{row.invoiceStatus}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-medium text-zinc-900">
                      {formatCurrency(row.amountPaid, row.currency)}
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-medium text-zinc-900">
                      {row.currentTierPrice === null ? "—" : formatCurrency(row.currentTierPrice, row.currency)}
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-semibold">
                      {row.difference === null ? (
                        <span className="text-zinc-500">—</span>
                      ) : row.difference > 0 ? (
                        <span className="text-amber-700">Owes {formatCurrency(row.difference, row.currency)}</span>
                      ) : row.difference < 0 ? (
                        <span className="text-rose-700">
                          Overpaid {formatCurrency(Math.abs(row.difference), row.currency)}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Even</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-zinc-500">{formatDate(row.paidAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
