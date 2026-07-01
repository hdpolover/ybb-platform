// app/components/revenue/RevenueTransactionsTable.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  listRevenueTransactions,
  exportRevenueTransactionsExcel,
  type InvoiceStatus,
  type RevenueTransactionRow,
  type RevenueTransactionsMeta,
} from "@/src/shared/api-client";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { FilterSelect } from "@/src/ui/select";
import { FilterGrid, FilterField, FilterActions } from "@/src/ui/filter-grid";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";
import { formatDate, formatDateTime } from "@/lib/utils";
import { formatMoney, formatNullableIdr, formatPaymentMethodLabel } from "./revenue-format";
import { UnbackfilledBanner } from "./UnbackfilledBanner";

const STATUS_VALUES = ["", "unpaid", "paid", "processing", "failed", "cancelled", "refunded"] as const;
const CURRENCY_VALUES = ["", "IDR", "USD"] as const;

const STATUS_CLASS: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

const transactionsFilterParsers = {
  status: parseAsStringEnum([...STATUS_VALUES]).withDefault("").withOptions({ clearOnDefault: true }),
  currency: parseAsStringEnum([...CURRENCY_VALUES]).withDefault("").withOptions({ clearOnDefault: true }),
  paymentMethod: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  programId: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  dateFrom: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  dateTo: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  paidFrom: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  paidTo: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  pageSize: parseAsInteger.withDefault(20).withOptions({ clearOnDefault: true }),
};

interface RevenueTransactionsTableProps {
  /** Per-program page: locks every request to this program, hides the program filter. */
  fixedProgramId?: string;
  /** Platform page: scopes every request to the brand currently selected above the table. */
  fixedBrandId?: string;
  /** Platform page only: lets the admin additionally drill into one program within scope. */
  programOptions?: Array<{ id: string; name: string }>;
}

/**
 * Audit transactions table shared by the platform-wide and per-program
 * revenue pages. Not built on `FilterPanel` because that component mandates
 * a search box, and the transactions endpoint has no `search` query param —
 * `FilterGrid`/`FilterField`/`FilterActions` (same file) are used instead.
 */
export function RevenueTransactionsTable({
  fixedProgramId,
  fixedBrandId,
  programOptions,
}: RevenueTransactionsTableProps) {
  const [rows, setRows] = useState<RevenueTransactionRow[]>([]);
  const [meta, setMeta] = useState<RevenueTransactionsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useQueryStates(transactionsFilterParsers);
  const {
    status: statusFilter,
    currency: currencyFilter,
    paymentMethod: paymentMethodFilter,
    programId: programIdFilter,
    dateFrom,
    dateTo,
    paidFrom,
    paidTo,
    page,
    pageSize,
  } = filters;

  const router = useRouter();
  const effectiveProgramId = fixedProgramId ?? (programIdFilter || undefined);

  const hasActiveFilters = Boolean(
    statusFilter ||
    currencyFilter ||
    paymentMethodFilter ||
    (!fixedProgramId && programIdFilter) ||
    dateFrom ||
    dateTo ||
    paidFrom ||
    paidTo ||
    pageSize !== 20,
  );

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listRevenueTransactions({
        page,
        limit: pageSize,
        status: (statusFilter || undefined) as InvoiceStatus | undefined,
        currency: currencyFilter || undefined,
        programId: effectiveProgramId,
        brandId: fixedBrandId,
        paymentMethod: paymentMethodFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        paidFrom: paidFrom || undefined,
        paidTo: paidTo || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    statusFilter,
    currencyFilter,
    effectiveProgramId,
    fixedBrandId,
    paymentMethodFilter,
    dateFrom,
    dateTo,
    paidFrom,
    paidTo,
  ]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  async function handleExport() {
    setExporting(true);
    try {
      await exportRevenueTransactionsExcel({
        status: (statusFilter || undefined) as InvoiceStatus | undefined,
        currency: currencyFilter || undefined,
        programId: effectiveProgramId,
        brandId: fixedBrandId,
        paymentMethod: paymentMethodFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        paidFrom: paidFrom || undefined,
        paidTo: paidTo || undefined,
      });
      toast.success("Export started — check your downloads.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export transactions.");
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    void setFilters({
      status: null,
      currency: null,
      paymentMethod: null,
      programId: null,
      dateFrom: null,
      dateTo: null,
      paidFrom: null,
      paidTo: null,
      pageSize: null,
      page: null,
    });
  }

  const showProgramColumn = !fixedProgramId;
  const colSpan = showProgramColumn ? 8 : 7;

  const programSelectOptions = useMemo(() => programOptions ?? [], [programOptions]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Transactions</h2>
          <p className="text-xs text-zinc-500">Invoice-level audit trail with fee/net breakdown.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleExport()}
          disabled={exporting || loading}
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? "Exporting…" : "Export to Excel"}
        </Button>
      </div>

      <div className="space-y-3 border-b border-zinc-200 px-4 py-3">
        <FilterGrid className="sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Status" htmlFor="txn-status">
            <FilterSelect
              id="txn-status"
              value={statusFilter}
              onChange={(e) => { void setFilters({ status: (e.target.value || null) as typeof statusFilter | null, page: 1 }); }}
            >
              <option value="">All Statuses</option>
              {STATUS_VALUES.filter(Boolean).map((s) => (
                <option key={s} value={s}>{formatLabel(s)}</option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Currency" htmlFor="txn-currency">
            <FilterSelect
              id="txn-currency"
              value={currencyFilter}
              onChange={(e) => { void setFilters({ currency: (e.target.value || null) as typeof currencyFilter | null, page: 1 }); }}
            >
              <option value="">All Currencies</option>
              {CURRENCY_VALUES.filter(Boolean).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Payment method" htmlFor="txn-method">
            <Input
              id="txn-method"
              value={paymentMethodFilter}
              onChange={(e) => { void setFilters({ paymentMethod: e.target.value || null, page: 1 }); }}
              placeholder="e.g. bank_transfer"
              className="h-10 text-sm"
            />
          </FilterField>
          {!fixedProgramId && programSelectOptions.length > 0 && (
            <FilterField label="Program" htmlFor="txn-program">
              <FilterSelect
                id="txn-program"
                value={programIdFilter}
                onChange={(e) => { void setFilters({ programId: e.target.value || null, page: 1 }); }}
              >
                <option value="">All Programs</option>
                {programSelectOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </FilterSelect>
            </FilterField>
          )}
          <FilterField label="Invoice date from" htmlFor="txn-date-from">
            <Input
              id="txn-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => { void setFilters({ dateFrom: e.target.value || null, page: 1 }); }}
              className="h-10 text-sm"
            />
          </FilterField>
          <FilterField label="Invoice date to" htmlFor="txn-date-to">
            <Input
              id="txn-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => { void setFilters({ dateTo: e.target.value || null, page: 1 }); }}
              className="h-10 text-sm"
            />
          </FilterField>
          <FilterField label="Paid date from" htmlFor="txn-paid-from">
            <Input
              id="txn-paid-from"
              type="date"
              value={paidFrom}
              onChange={(e) => { void setFilters({ paidFrom: e.target.value || null, page: 1 }); }}
              className="h-10 text-sm"
            />
          </FilterField>
          <FilterField label="Paid date to" htmlFor="txn-paid-to">
            <Input
              id="txn-paid-to"
              type="date"
              value={paidTo}
              onChange={(e) => { void setFilters({ paidTo: e.target.value || null, page: 1 }); }}
              className="h-10 text-sm"
            />
          </FilterField>
        </FilterGrid>
        <FilterActions resultCount={meta?.total} onClear={clearFilters} disabled={!hasActiveFilters} />
      </div>

      {meta && meta.summary.unbackfilledCount > 0 && (
        <div className="px-4 pt-3">
          <UnbackfilledBanner count={meta.summary.unbackfilledCount} />
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            {showProgramColumn && <TableHead>Program</TableHead>}
            <TableHead>Participant</TableHead>
            <TableHead>Gross</TableHead>
            <TableHead>Fee (est.)</TableHead>
            <TableHead>Net (est.)</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-10 text-center text-zinc-400">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TableCell>
            </TableRow>
          )}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-zinc-400">
                No transactions found.
              </TableCell>
            </TableRow>
          )}
          {!loading && rows.map((row) => (
            <TableRow
              key={row.invoiceId}
              onClick={() => router.push(`/programs/${row.programId}/payments/${row.invoiceId}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/programs/${row.programId}/payments/${row.invoiceId}`);
                }
              }}
              role="link"
              tabIndex={0}
              className="cursor-pointer hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none"
            >
              <TableCell className="min-w-[150px]">
                <div className="font-mono text-xs text-zinc-500">
                  {row.invoiceId.slice(0, 8)}…{row.invoiceId.slice(-4)}
                </div>
                <div className="text-xs text-zinc-400">Issued: {formatDate(row.createdAt)}</div>
                <div className="text-xs text-zinc-400">Paid: {row.paidAt ? formatDateTime(row.paidAt) : "—"}</div>
                {row.externalTransactionId && (
                  <div className="font-mono text-xs text-zinc-400">
                    Txn: {row.externalTransactionId.slice(0, 8)}…{row.externalTransactionId.slice(-4)}
                  </div>
                )}
              </TableCell>
              {showProgramColumn && (
                <TableCell className="text-sm text-zinc-700">{row.programName}</TableCell>
              )}
              <TableCell className="text-sm font-medium text-zinc-900">{row.participantName}</TableCell>
              <TableCell className="text-sm font-medium">{formatMoney(row.grossAmount, row.currency as "IDR" | "USD")}</TableCell>
              <TableCell className="text-sm text-zinc-600">{formatNullableIdr(row.feeIdr)}</TableCell>
              <TableCell className="text-sm text-zinc-600">{formatNullableIdr(row.netIdr)}</TableCell>
              <TableCell className="text-sm text-zinc-500">
                {row.paymentMethod && row.paymentMethod !== "unknown"
                  ? formatPaymentMethodLabel(row.paymentMethod)
                  : "—"}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${
                    STATUS_CLASS[row.status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200"
                  }`}
                >
                  {row.status}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {meta && (meta.page > 1 || meta.totalPages > 1) && (
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
          <span>Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => void setFilters({ page: page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (meta.totalPages ?? 1)}
              onClick={() => void setFilters({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
