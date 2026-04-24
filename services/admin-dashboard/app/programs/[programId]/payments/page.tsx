"use client";

import { use, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Search, Eye, Loader2, RefreshCw, DollarSign, Clock, XCircle, CheckCircle2 } from "lucide-react";
import {
  listProgramInvoices,
  type InvoiceListItem,
  type InvoiceStatus,
  type InvoiceSummary,
  type PaginatedMeta,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { PageHeader } from "@/src/admin/page-header";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_CLASS[status as InvoiceStatus] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

const PAGE_SIZE = 20;

export default function PaymentsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms, adminProfile } = useAuth();

  const program = useMemo(
    () => accessiblePrograms.find((p) => p.programId === programId || p.programSlug === programId),
    [accessiblePrograms, programId],
  );
  const resolvedProgramId = program?.programId ?? programId;

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchInvoices = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listProgramInvoices({
        programId: resolvedProgramId,
        page,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setInvoices(res.data);
      setMeta(res.meta);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId, page, statusFilter, search]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const paidAmount = summary?.paid?.amount ?? 0;
  const paidCount = summary?.paid?.count ?? 0;
  const pendingCount = (summary?.unpaid?.count ?? 0) + (summary?.processing?.count ?? 0);
  const failedCount = summary?.failed?.count ?? 0;

  // Assume first invoice currency for display (most will be same currency)
  const currency = invoices[0]?.currency ?? "IDR";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={`Invoice records${program ? ` for ${program.programName}` : ""}`}
        actions={
          <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          label="Total Collected"
          value={formatCurrency(paidAmount, currency)}
          sub={`${paidCount} paid invoice${paidCount !== 1 ? "s" : ""}`}
          color="emerald"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-blue-600" />}
          label="Paid"
          value={String(paidCount)}
          sub="invoices"
          color="blue"
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          label="Pending"
          value={String(pendingCount)}
          sub="unpaid / processing"
          color="amber"
        />
        <StatCard
          icon={<XCircle className="h-4 w-4 text-red-600" />}
          label="Failed"
          value={String(failedCount)}
          sub="failed invoices"
          color="red"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 h-8"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-400">
            {meta ? `${meta.total} result${meta.total !== 1 ? "s" : ""}` : ""}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-zinc-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!loading && invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-zinc-400">
                  No invoices found.
                </TableCell>
              </TableRow>
            )}
            {!loading && invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="text-sm text-zinc-500 whitespace-nowrap">
                  {new Date(inv.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{inv.participant.fullName}</div>
                  <div className="text-xs text-zinc-400">{inv.participant.email ?? "—"}</div>
                </TableCell>
                <TableCell className="text-sm text-zinc-600">
                  {inv.pricingTier.name}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {formatCurrency(inv.amount, inv.currency)}
                </TableCell>
                <TableCell className="text-sm text-zinc-500 capitalize">
                  {inv.paymentMethod ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusPill status={inv.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/programs/${programId}/payments/${inv.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Link>
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
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (meta.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: "emerald" | "blue" | "amber" | "red";
}) {
  const border: Record<string, string> = {
    emerald: "border-emerald-100",
    blue: "border-blue-100",
    amber: "border-amber-100",
    red: "border-red-100",
  };
  return (
    <div className={`rounded-lg border ${border[color]} bg-white p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-zinc-500">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-zinc-900">{value}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>
    </div>
  );
}
