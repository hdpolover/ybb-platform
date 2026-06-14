"use client";

import { use, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Eye,
  Copy,
  Loader2,
  RefreshCw,
  DollarSign,
  Clock,
  XCircle,
  CheckCircle2,
  FilterX,
  CircleDollarSign,
} from "lucide-react";
import {
  listProgramInvoices,
  type InvoiceListItem,
  type InvoiceStatus,
  type InvoiceSummary,
  type PaginatedMeta,
  type InvoiceMetrics,
  type InvoiceFilterOptions,
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
import { formatDate, formatDateTime } from "@/lib/utils";

const SORT_OPTIONS: Array<{ value: "createdAt" | "paidAt" | "amount" | "updatedAt"; label: string }> = [
  { value: "updatedAt", label: "Recently Updated" },
  { value: "createdAt", label: "Newest Invoice" },
  { value: "paidAt", label: "Newest Payment" },
  { value: "amount", label: "Highest Amount" },
];

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
};

const FOLLOW_UP_CLASS: Record<string, string> = {
  participant_cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  payment_cancelled_issue: "bg-rose-50 text-rose-700 border-rose-200",
  payment_failed: "bg-red-50 text-red-700 border-red-200",
  manual_proof_rejected: "bg-orange-50 text-orange-700 border-orange-200",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const FILTER_SELECT_CLASS = "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 pr-8 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500";
const REGION_NAMES = typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCountryName(value: string | null | undefined) {
  if (!value) return "—";
  const raw = value.trim();
  if (!raw) return "—";
  if (REGION_NAMES && /^[A-Za-z]{2}$/.test(raw)) {
    const code = raw.toUpperCase();
    try {
      return REGION_NAMES.of(code) ?? code;
    } catch {
      return code;
    }
  }
  return formatLabel(raw);
}

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_CLASS[status as InvoiceStatus] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

function FollowUpPill({ status }: { status: InvoiceListItem["followUpStatus"] }) {
  if (!status) return null;
  const cls = FOLLOW_UP_CLASS[status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {formatLabel(status)}
    </span>
  );
}

export default function PaymentsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { accessiblePrograms } = useAuth();

  const program = useMemo(
    () => accessiblePrograms.find((p) => p.programId === programId || p.programSlug === programId),
    [accessiblePrograms, programId],
  );
  const resolvedProgramId = program?.programId ?? programId;

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [overallSummary, setOverallSummary] = useState<InvoiceSummary | null>(null);
  const [metrics, setMetrics] = useState<InvoiceMetrics | null>(null);
  const [filterOptions, setFilterOptions] = useState<InvoiceFilterOptions>({
    tiers: [],
    paymentMethods: [],
    currencies: [],
    applicationStatuses: [],
    invoiceStatuses: [],
    followUpStatuses: [],
    feeTypes: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [feeTypeFilter, setFeeTypeFilter] = useState("");
  const [applicationStatusFilter, setApplicationStatusFilter] = useState("");
  const [followUpStatusFilter, setFollowUpStatusFilter] = useState<"" | "participant_cancelled" | "payment_cancelled_issue" | "payment_failed" | "manual_proof_rejected">("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paidFrom, setPaidFrom] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "paidAt" | "amount" | "updatedAt">("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const hasActiveFilters = Boolean(
    search.trim() ||
    statusFilter ||
    paymentMethodFilter ||
    tierFilter ||
    feeTypeFilter ||
    applicationStatusFilter ||
    followUpStatusFilter ||
    currencyFilter ||
    dateFrom ||
    dateTo ||
    paidFrom ||
    paidTo ||
    minAmount ||
    maxAmount ||
    sortBy !== "updatedAt" ||
    sortOrder !== "desc" ||
    pageSize !== 20,
  );

  const fetchInvoices = useCallback(async () => {
    if (!resolvedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listProgramInvoices({
        programId: resolvedProgramId,
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
        paymentMethod: paymentMethodFilter || undefined,
        tierId: tierFilter || undefined,
        feeType: feeTypeFilter || undefined,
        applicationStatus: applicationStatusFilter || undefined,
        followUpStatus: followUpStatusFilter || undefined,
        currency: currencyFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        paidFrom: paidFrom || undefined,
        paidTo: paidTo || undefined,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
        sortBy,
        sortOrder,
      });
      setInvoices(res.data);
      setMeta(res.meta);
      setSummary(res.summary);
      setOverallSummary(res.overallSummary);
      setMetrics(res.metrics);
      setFilterOptions(res.filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [
    resolvedProgramId,
    page,
    pageSize,
    statusFilter,
    search,
    paymentMethodFilter,
    tierFilter,
    feeTypeFilter,
    applicationStatusFilter,
    followUpStatusFilter,
    currencyFilter,
    dateFrom,
    dateTo,
    paidFrom,
    paidTo,
    minAmount,
    maxAmount,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setPaymentMethodFilter("");
    setTierFilter("");
    setFeeTypeFilter("");
    setApplicationStatusFilter("");
    setFollowUpStatusFilter("");
    setCurrencyFilter("");
    setDateFrom("");
    setDateTo("");
    setPaidFrom("");
    setPaidTo("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("updatedAt");
    setSortOrder("desc");
    setPageSize(20);
    setPage(1);
  }

  const currency = invoices[0]?.currency ?? filterOptions.currencies[0]?.value ?? "USD";
  const statusOptions = useMemo(
    () => [
      { value: "", label: "All Statuses" },
      ...filterOptions.invoiceStatuses.map((option) => ({
        value: option.value,
        label: `${formatLabel(option.value)} (${option.count})`,
      })),
    ],
    [filterOptions.invoiceStatuses],
  );
  const feeTypeOptions = useMemo(
    () => [
      { value: "", label: "All Fee Types" },
      ...filterOptions.feeTypes.map((option) => ({
        value: option.value,
        label: `${formatLabel(option.value)} (${option.count})`,
      })),
    ],
    [filterOptions.feeTypes],
  );
  const followUpOptions = useMemo(
    () => [
      { value: "", label: "All Follow-up Statuses" },
      ...filterOptions.followUpStatuses.map((option) => ({
        value: option.value,
        label: `${formatLabel(option.value)} (${option.count})`,
      })),
    ],
    [filterOptions.followUpStatuses],
  );
  const paidCount = summary?.paid?.count ?? 0;
  const pendingCount = (summary?.unpaid?.count ?? 0) + (summary?.processing?.count ?? 0);
  const failedCount = summary?.failed?.count ?? 0;
  const cancelledCount = summary?.cancelled?.count ?? 0;
  const followUpCount = failedCount + cancelledCount;
  const collectionRate = metrics?.collectionRate ?? 0;
  const totalInvoices = metrics?.totalInvoices ?? 0;
  const totalAmount = metrics?.totalAmount ?? 0;
  const paidAmount = metrics?.paidAmount ?? 0;
  const outstandingAmount = metrics?.outstandingAmount ?? 0;
  const averagePaidAmount = metrics?.averagePaidAmount ?? 0;

  async function handleCopy(key: string, value: string | null | undefined) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // no-op
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={`Invoice records${program ? ` for ${program.programName}` : ""}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchInvoices()} disabled={loading}>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          label="Total Collected"
          value={formatCurrency(paidAmount, currency)}
          sub={`${paidCount} paid invoice${paidCount !== 1 ? "s" : ""}`}
          color="emerald"
        />
        <StatCard
          icon={<CircleDollarSign className="h-4 w-4 text-blue-600" />}
          label="Total Invoiced"
          value={formatCurrency(totalAmount, currency)}
          sub={`${totalInvoices} invoices`}
          color="blue"
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          label="Outstanding"
          value={formatCurrency(outstandingAmount, currency)}
          sub={`${pendingCount} pending`}
          color="amber"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-indigo-600" />}
          label="Collection Rate"
          value={`${collectionRate.toFixed(1)}%`}
          sub={`Avg paid ${formatCurrency(averagePaidAmount, currency)}`}
          color="indigo"
        />
        <StatCard
          icon={<XCircle className="h-4 w-4 text-red-600" />}
          label="Follow-up Needed"
          value={String(followUpCount)}
          sub={`${overallSummary?.failed?.count ?? failedCount} failed, ${overallSummary?.cancelled?.count ?? cancelledCount} cancelled program-wide`}
          color="red"
        />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="space-y-3 border-b border-zinc-200 px-4 py-3">
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <Input
                placeholder="Search name, email, invoice ID, transaction ID…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-10 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className={FILTER_SELECT_CLASS}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={paymentMethodFilter}
              onChange={(e) => { setPaymentMethodFilter(e.target.value); setPage(1); }}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All Methods</option>
              {filterOptions.paymentMethods.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label ?? option.value} ({option.count})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <select
              value={tierFilter}
              onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All Tiers</option>
              {filterOptions.tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
            <select
              value={feeTypeFilter}
              onChange={(e) => { setFeeTypeFilter(e.target.value); setPage(1); }}
              className={FILTER_SELECT_CLASS}
            >
              {feeTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={applicationStatusFilter}
              onChange={(e) => { setApplicationStatusFilter(e.target.value); setPage(1); }}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All Application Statuses</option>
              {filterOptions.applicationStatuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {formatLabel(option.value)} ({option.count})
                </option>
              ))}
            </select>
            <select
              value={followUpStatusFilter}
              onChange={(e) => { setFollowUpStatusFilter(e.target.value as "" | "participant_cancelled" | "payment_cancelled_issue" | "payment_failed" | "manual_proof_rejected"); setPage(1); }}
              className={FILTER_SELECT_CLASS}
            >
              {followUpOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={currencyFilter}
              onChange={(e) => { setCurrencyFilter(e.target.value); setPage(1); }}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All Currencies</option>
              {filterOptions.currencies.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} ({option.count})
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="0"
              step="1"
              value={minAmount}
              onChange={(e) => { setMinAmount(e.target.value); setPage(1); }}
              className="h-10 text-sm"
              placeholder="Min amount"
            />
            <Input
              type="number"
              min="0"
              step="1"
              value={maxAmount}
              onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }}
              className="h-10 text-sm"
              placeholder="Max amount"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-500">Invoice date from</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="h-10 text-sm"
                aria-label="Invoice date from"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-500">Invoice date to</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="h-10 text-sm"
                aria-label="Invoice date to"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-500">Paid date from</label>
              <Input
                type="date"
                value={paidFrom}
                onChange={(e) => { setPaidFrom(e.target.value); setPage(1); }}
                className="h-10 text-sm"
                aria-label="Paid date from"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-500">Paid date to</label>
              <Input
                type="date"
                value={paidTo}
                onChange={(e) => { setPaidTo(e.target.value); setPage(1); }}
                className="h-10 text-sm"
                aria-label="Paid date to"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-500">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as "createdAt" | "paidAt" | "amount" | "updatedAt"); setPage(1); }}
                className={FILTER_SELECT_CLASS}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-500">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => { setSortOrder(e.target.value as "asc" | "desc"); setPage(1); }}
                className={FILTER_SELECT_CLASS}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-500">Page size</label>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className={FILTER_SELECT_CLASS}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}/page</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-400">
              {meta ? `${meta.total} result${meta.total !== 1 ? "s" : ""}` : ""}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="h-8 text-xs"
            >
              <FilterX className="mr-1.5 h-3.5 w-3.5" />
              Clear filters
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead>Tier / Fee Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-zinc-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!loading && invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-zinc-400">
                  No invoices found.
                </TableCell>
              </TableRow>
            )}
            {!loading && invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="min-w-[170px]">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
                    <span>{inv.id.slice(0, 8)}…{inv.id.slice(-4)}</span>
                    <CopyCellButton
                      copied={copiedKey === `invoice-${inv.id}`}
                      onClick={() => void handleCopy(`invoice-${inv.id}`, inv.id)}
                    />
                  </div>
                  <div className="text-xs text-zinc-400">
                    Issued: {formatDate(inv.createdAt)}
                  </div>
                  <div className="text-xs text-zinc-400">
                    Paid: {inv.paidAt ? formatDateTime(inv.paidAt) : "—"}
                  </div>
                  {inv.externalTransactionId ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-mono text-zinc-400">
                      <span>Txn: {inv.externalTransactionId.slice(0, 8)}…{inv.externalTransactionId.slice(-4)}</span>
                      <CopyCellButton
                        copied={copiedKey === `transaction-${inv.id}`}
                        onClick={() => void handleCopy(`transaction-${inv.id}`, inv.externalTransactionId)}
                      />
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{inv.participant.fullName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span>{inv.participant.email ?? "—"}</span>
                    {inv.participant.email && (
                      <CopyCellButton
                        copied={copiedKey === `email-${inv.id}`}
                        onClick={() => void handleCopy(`email-${inv.id}`, inv.participant.email)}
                      />
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">{formatCountryName(inv.participant.originCountry ?? inv.participant.nationality)}</div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span>ID: {inv.participant.id.slice(0, 8)}…{inv.participant.id.slice(-4)}</span>
                    <CopyCellButton
                      copied={copiedKey === `participant-${inv.id}`}
                      onClick={() => void handleCopy(`participant-${inv.id}`, inv.participant.id)}
                    />
                  </div>
                  {inv.participant.ambassador && (
                    <AmbassadorBadge ambassador={inv.participant.ambassador} />
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium text-zinc-700">{inv.pricingTier.name}</div>
                  <div className="text-xs text-zinc-400">{formatLabel(inv.pricingTier.feeType)}</div>
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {formatCurrency(inv.amount, inv.currency)}
                </TableCell>
                <TableCell className="text-sm text-zinc-500">
                  {inv.paymentMethod ?? "Not recorded"}
                </TableCell>
                <TableCell className="text-sm text-zinc-600">
                  <div>{formatLabel(inv.application.status)}</div>
                  <div className="text-xs text-zinc-400">
                    {formatLabel(inv.application.applicationCategory)}
                  </div>
                  {inv.application.ticketStatus ? (
                    <div className="text-xs text-zinc-400">
                      Ticket: {formatLabel(inv.application.ticketStatus)}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <StatusPill status={inv.status} />
                    <FollowUpPill status={inv.followUpStatus} />
                  </div>
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
  color: "emerald" | "blue" | "amber" | "red" | "indigo";
}) {
  const border: Record<string, string> = {
    emerald: "border-emerald-100",
    blue: "border-blue-100",
    amber: "border-amber-100",
    red: "border-red-100",
    indigo: "border-indigo-100",
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

function CopyCellButton({
  copied,
  onClick,
}: {
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
      title={copied ? "Copied" : "Copy"}
      aria-label={copied ? "Copied" : "Copy"}
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

function AmbassadorBadge({
  ambassador,
}: {
  ambassador: { referralCode: string; isActive: boolean; isSameProgram: boolean };
}) {
  const activeClass = ambassador.isActive
    ? ambassador.isSameProgram
      ? "bg-violet-50 text-violet-700 border-violet-200"
      : "bg-indigo-50 text-indigo-700 border-indigo-200"
    : "bg-zinc-100 text-zinc-500 border-zinc-200";

  const label = ambassador.isSameProgram ? "Ambassador" : "Amb. (other prog.)";
  const title = ambassador.isActive
    ? ambassador.isSameProgram
      ? `Ambassador for this program (code: ${ambassador.referralCode})`
      : `Ambassador for a different program (code: ${ambassador.referralCode})`
    : `Inactive ambassador (code: ${ambassador.referralCode})`;

  return (
    <span
      className={`mt-1 inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${activeClass}`}
      title={title}
    >
      {label}
      {!ambassador.isActive && " (inactive)"}
      {" "}
      <span className="ml-1 font-mono">{ambassador.referralCode}</span>
    </span>
  );
}
