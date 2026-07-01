"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Users,
  CreditCard,
  TrendingUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  getProgramDashboardAnalytics,
  getProgramAnalytics,
  type ProgramDashboardAnalytics,
  type ProgramAnalytics,
  type AnalyticsFilters,
} from "@/src/shared/api-client";
import { PageHeader } from "@/src/admin/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { TrendSection, type TrendRange } from "@/app/components/dashboard/sections/TrendSection";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/src/ui/dropdown-menu";
import { TopAmbassadorsSection } from "@/app/components/dashboard/sections/TopAmbassadorsSection";
import { AmbassadorsDetailsModal } from "@/app/components/dashboard/modals/AmbassadorsDetailsModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtIDR(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${n.toLocaleString()}`;
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#6366f1",
];

const APP_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "interview_scheduled", label: "Interview" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "withdrawn", label: "Withdrawn" },
];
const PAY_STATUSES = ["paid", "processing", "unpaid", "failed", "cancelled"] as const;
const APP_CATEGORIES = [
  { value: "fully_funded", label: "Fully Funded" },
  { value: "self_funded", label: "Self Funded" },
];

// ─── Filter bar ───────────────────────────────────────────────────────────────

const INP = "h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500";
const SEL = "h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500";
const LBL = "text-[10px] font-medium uppercase tracking-wide text-zinc-500";

function FLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LBL}>{label}</span>
      {children}
    </label>
  );
}

interface MultiSelectOption {
  value: string;
  label: string;
}

function MultiSelectDropdown({
  value,
  onChange,
  options,
  placeholder = "All statuses",
}: {
  value: string[];
  onChange: (v: string[] | undefined) => void;
  options: MultiSelectOption[];
  placeholder?: string;
}) {
  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} selected`;

  function toggle(optValue: string) {
    const next = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue];
    onChange(next.length > 0 ? next : undefined);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 min-w-[140px] items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className="truncate">{triggerLabel}</span>
          <svg
            className="h-3.5 w-3.5 shrink-0 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={value.includes(opt.value)}
            onCheckedChange={() => toggle(opt.value)}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterBar({ tab, filters, onChange, onApply, onClear }: {
  tab: string; filters: AnalyticsFilters;
  onChange: (f: AnalyticsFilters) => void; onApply: () => void; onClear: () => void;
}) {
  const isP = tab === "participants";
  const set = (patch: Partial<AnalyticsFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-end gap-2">
          <FLabel label={isP ? "Reg. From" : "Pay From"}>
            <input type="date" className={INP}
              value={isP ? (filters.dateFrom ?? "") : (filters.payDateFrom ?? "")}
              onChange={(e) => set(isP ? { dateFrom: e.target.value || undefined } : { payDateFrom: e.target.value || undefined })}
            />
          </FLabel>
          <span className="mb-2 text-sm text-zinc-400">-</span>
          <FLabel label="To">
            <input type="date" className={INP}
              value={isP ? (filters.dateTo ?? "") : (filters.payDateTo ?? "")}
              onChange={(e) => set(isP ? { dateTo: e.target.value || undefined } : { payDateTo: e.target.value || undefined })}
            />
          </FLabel>
        </div>

        {isP ? (
          <>
            <FLabel label="Status">
              <MultiSelectDropdown
                value={filters.appStatuses ?? []}
                onChange={(v) => set({ appStatuses: v })}
                options={APP_STATUSES}
                placeholder="All statuses"
              />
            </FLabel>
            <FLabel label="Category">
              <select className={SEL} value={filters.appCategory ?? ""}
                onChange={(e) => set({ appCategory: e.target.value || undefined })}
              >
                <option value="">All</option>
                {APP_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </FLabel>
          </>
        ) : (
          <>
            <FLabel label="Pay Status">
              <MultiSelectDropdown
                value={filters.paymentStatuses ?? []}
                onChange={(v) => set({ paymentStatuses: v })}
                options={PAY_STATUSES.map((s) => ({ value: s, label: humanizeKey(s) }))}
                placeholder="All statuses"
              />
            </FLabel>
            <FLabel label="Currency">
              <select className={SEL} value={filters.currency ?? ""}
                onChange={(e) => set({ currency: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
              </select>
            </FLabel>
          </>
        )}

        <div className="flex items-end gap-2">
          <button onClick={onApply} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">Apply</button>
          <button onClick={onClear} className="h-9 rounded-md border border-zinc-300 px-4 text-sm text-zinc-600 hover:bg-zinc-50">Clear</button>
        </div>
      </div>
    </div>
  );
}

// ─── Small primitives ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      {icon && (
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${accent ?? "bg-blue-50 text-blue-500"}`}>
          {icon}
        </div>
      )}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold text-zinc-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  sub,
  children,
  className,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${className ?? ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-100 ${className ?? ""}`} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

// ─── Participants tab ─────────────────────────────────────────────────────────

function ParticipantsTab({
  analytics,
  dashboard,
}: {
  analytics: ProgramAnalytics;
  dashboard: ProgramDashboardAnalytics;
}) {
  const { funnel, byCategory, byEducation, topInstitutions } = analytics.participants;
  const totalRegistered = funnel[0]?.count ?? 0;

  const [trendRange, setTrendRange] = useState<TrendRange>("daily");
  const [ambassadorsOpen, setAmbassadorsOpen] = useState(false);

  const trendData = dashboard.trend[trendRange];

  return (
    <div className="space-y-6">
      {/* Registration Trend line chart */}
      <TrendSection
        trendRange={trendRange}
        onChangeTrendRange={setTrendRange}
        data={trendData}
      />

      {/* KPI row derived from funnel */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {funnel.map((step, i) => (
          <StatCard
            key={step.stage}
            label={step.stage}
            value={step.count.toLocaleString()}
            sub={i > 0 ? `${step.pct}% of registered` : undefined}
            accent={i === 0 ? "bg-blue-50 text-blue-500" : i === funnel.length - 1 ? "bg-emerald-50 text-emerald-500" : "bg-zinc-100 text-zinc-500"}
            icon={<Users className="h-4 w-4" />}
          />
        ))}
      </div>

      {/* Funnel chart */}
      <ChartCard title="Registration Funnel" sub="Drop-off at each stage">
        <div className="space-y-2">
          {funnel.map((step) => (
            <div key={step.stage} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 text-xs text-zinc-500">{step.stage}</span>
              <div className="flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-5 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${totalRegistered > 0 ? (step.count / totalRegistered) * 100 : 0}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-medium text-zinc-700">
                {step.count.toLocaleString()}
              </span>
              <span className="w-12 shrink-0 text-right text-xs text-zinc-400">{step.pct}%</span>
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Gender */}
        <ChartCard title="Gender" sub="Participant gender distribution">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboard.gender}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={2}
                  label={({ value }: { value?: number; name?: string }) => {
                    const total = dashboard.gender.reduce((s, g) => s + g.value, 0);
                    const pct = total ? (((value ?? 0) / total) * 100).toFixed(0) : "0";
                    return `${pct}%`;
                  }}
                  labelLine={false}
                >
                  {dashboard.gender.map((_, idx) => (
                    <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={30}
                  formatter={(v) => <span className="text-[11px] text-zinc-600">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Application category */}
        <ChartCard title="Application Category" sub="Self-funded vs Fully-funded">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory.map((c) => ({ name: humanizeKey(c.category), value: c.count }))}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={2}
                  label={({ value }: { value?: number; name?: string }) => {
                    const total = byCategory.reduce((s, c) => s + c.count, 0);
                    const pct = total ? (((value ?? 0) / total) * 100).toFixed(0) : "0";
                    return `${pct}%`;
                  }}
                  labelLine={false}
                >
                  {byCategory.map((_, idx) => (
                    <Cell key={idx} fill={PALETTE[(idx + 2) % PALETTE.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={30}
                  formatter={(v) => <span className="text-[11px] text-zinc-600">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Age */}
        <ChartCard title="Age Distribution" sub="Participants by age range">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.age} margin={{ left: -20, right: 4, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top nationalities */}
        <ChartCard title="Top Nationalities" sub="Countries with most participants">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboard.nationalities.slice(0, 10)}
                layout="vertical"
                margin={{ left: 40, right: 10, top: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="country"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Education level */}
        <ChartCard title="Education Level" sub="Highest degree attained">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byEducation.map((e) => ({ ...e, level: humanizeKey(e.level) }))}
                layout="vertical"
                margin={{ left: 50, right: 10, top: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="level"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Top institutions */}
      <ChartCard title="Top Institutions / Universities" sub="Most represented schools among applicants">
        <div className="divide-y divide-zinc-100">
          {topInstitutions.length === 0 && (
            <p className="py-4 text-center text-xs text-zinc-400">No institution data available.</p>
          )}
          {topInstitutions.map((inst, idx) => {
            const max = topInstitutions[0]?.count ?? 1;
            const barPct = (inst.count / max) * 100;
            return (
              <div key={inst.name} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 shrink-0 text-center text-xs font-medium text-zinc-400">
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-700">{inst.name}</span>
                <div className="w-28 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-1.5 rounded-full bg-blue-400"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs font-medium text-zinc-600">
                  {inst.count}
                </span>
              </div>
            );
          })}
        </div>
      </ChartCard>

      {/* Top Ambassadors table */}
      <TopAmbassadorsSection
        data={dashboard.topAmbassadors}
        onOpenDetails={() => setAmbassadorsOpen(true)}
      />

      <AmbassadorsDetailsModal
        open={ambassadorsOpen}
        onClose={() => setAmbassadorsOpen(false)}
        data={dashboard.topAmbassadors}
      />
    </div>
  );
}

// ─── Payments tab ─────────────────────────────────────────────────────────────

function PaymentsTab({ analytics }: { analytics: ProgramAnalytics }) {
  const { kpis, revenueByMonth, byTier, byPaymentMethod, countriesByStatus } = analytics.payments;

  const revenueChartData = revenueByMonth.map((m) => ({
    ...m,
    idrM: parseFloat((m.idr / 1_000_000).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Revenue (IDR)"
          value={fmtIDR(kpis.totalRevenueIdr)}
          sub={kpis.totalRevenueUsd > 0 ? `+ ${fmtUSD(kpis.totalRevenueUsd)} USD` : undefined}
          accent="bg-emerald-50 text-emerald-500"
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          label="Paid Invoices"
          value={kpis.paidCount.toLocaleString()}
          sub={`${kpis.totalInvoices} total invoices`}
          accent="bg-blue-50 text-blue-500"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Conversion Rate"
          value={`${kpis.conversionRate}%`}
          sub="Submitted → Paid"
          accent="bg-purple-50 text-purple-500"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Processing / Unpaid"
          value={`${kpis.processingCount} / ${kpis.unpaidCount}`}
          sub={
            kpis.failedCount > 0 || kpis.cancelledCount > 0
              ? `${kpis.failedCount} failed, ${kpis.cancelledCount} cancelled`
              : "No failed or cancelled payments"
          }
          accent="bg-amber-50 text-amber-500"
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          label="Cancelled Invoices"
          value={kpis.cancelledCount.toLocaleString()}
          sub="Participant-cancelled or ambassador-converted"
          accent="bg-zinc-100 text-zinc-500"
          icon={<CreditCard className="h-4 w-4" />}
        />
      </div>

      {/* Invoice status breakdown */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        {[
          { label: "Paid", count: kpis.paidCount, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Processing", count: kpis.processingCount, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Unpaid", count: kpis.unpaidCount, color: "text-zinc-600", bg: "bg-zinc-50" },
          { label: "Failed", count: kpis.failedCount, color: "text-red-600", bg: "bg-red-50" },
          { label: "Cancelled", count: kpis.cancelledCount, color: "text-zinc-700", bg: "bg-zinc-100" },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border border-zinc-200 ${s.bg} px-4 py-3`}>
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className={`mt-1 text-xl font-semibold ${s.color}`}>{s.count.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {kpis.totalInvoices > 0
                ? `${((s.count / kpis.totalInvoices) * 100).toFixed(1)}% of total`
                : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <ChartCard title="Monthly Revenue" sub="IDR equivalent over the last 6 months">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueChartData} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}M`}
              />
              <Tooltip
                contentStyle={{ fontSize: 11 }}
                formatter={(v) => [`Rp ${(Number(v) * 1_000_000).toLocaleString()}`, "Revenue"]}
              />
              <Bar dataKey="idrM" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue (IDR)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Countries by payment status — stacked */}
      <ChartCard title="Payments by Country & Status" sub="Invoice breakdown per applicant country — top 15 by volume">
        {countriesByStatus.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-400">No invoice data yet.</p>
        ) : (
          <div style={{ height: `${Math.max(240, countriesByStatus.length * 28 + 60)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countriesByStatus} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend verticalAlign="top" height={28} formatter={(v) => <span className="text-[11px] capitalize text-zinc-600">{v}</span>} />
                <Bar dataKey="paid" stackId="a" fill="#10b981" name="Paid" />
                <Bar dataKey="processing" stackId="a" fill="#3b82f6" name="Processing" />
                <Bar dataKey="unpaid" stackId="a" fill="#a1a1aa" name="Unpaid" />
                <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                <Bar dataKey="cancelled" stackId="a" fill="#52525b" name="Cancelled" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Payment method */}
      <ChartCard title="Payment Methods" sub="How participants paid">
        {byPaymentMethod.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-400">No payment data yet.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byPaymentMethod.map((m) => ({ name: humanizeKey(m.method), value: m.count }))}
                  dataKey="value" cx="50%" cy="45%" outerRadius={75} paddingAngle={2}
                  label={({ value }: { value?: number; name?: string }) => {
                    const total = byPaymentMethod.reduce((s, m) => s + m.count, 0);
                    return `${total ? (((value ?? 0) / total) * 100).toFixed(0) : 0}%`;
                  }}
                  labelLine={false}
                >
                  {byPaymentMethod.map((_, idx) => <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />)}
                </Pie>
                <Legend verticalAlign="bottom" height={32} formatter={(v) => <span className="text-[11px] text-zinc-600">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* By pricing tier */}
      <ChartCard title="Revenue by Pricing Tier" sub="Paid invoice counts and amounts per tier">
        {byTier.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-400">No payment data yet.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {byTier.map((tier, idx) => {
              const maxCount = byTier[0]?.paidCount ?? 1;
              const barPct = (tier.paidCount / maxCount) * 100;
              return (
                <div key={tier.name} className="flex items-center gap-4 py-3 text-sm">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: PALETTE[idx % PALETTE.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-700">
                    {tier.name}
                  </span>
                  <div className="w-32 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${barPct}%`,
                        background: PALETTE[idx % PALETTE.length],
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-zinc-500">
                    {tier.paidCount} paid
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs font-medium text-zinc-700">
                    {tier.currency === "USD"
                      ? fmtUSD(tier.totalAmount)
                      : fmtIDR(tier.totalAmount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  // programId from the route may be a program slug; the stats endpoints need the
  // program UUID. Resolve it via the admin's accessible programs.
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useMemo(() => {
    const match = accessiblePrograms.find(
      (p) => p.programId === programId || p.programSlug === programId,
    );
    return match?.programId ?? programId;
  }, [accessiblePrograms, programId]);

  const [analytics, setAnalytics] = useState<ProgramAnalytics | null>(null);
  const [dashboard, setDashboard] = useState<ProgramDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("participants");
  const [pendingFilters, setPendingFilters] = useState<AnalyticsFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>({});

  const loadAnalytics = useCallback(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const [a, d] = await Promise.all([
          getProgramAnalytics(resolvedProgramId, appliedFilters),
          getProgramDashboardAnalytics(resolvedProgramId),
        ]);
        if (!mounted) return;
        setAnalytics(a);
        setDashboard(d);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load analytics.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [appliedFilters, resolvedProgramId]);

  useEffect(() => {
    return loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Centralized insights for participants and payments"
      />

      {analytics !== null && (
        <FilterBar
          tab={activeTab}
          filters={pendingFilters}
          onChange={setPendingFilters}
          onApply={() => setAppliedFilters({ ...pendingFilters })}
          onClear={() => { setPendingFilters({}); setAppliedFilters({}); }}
        />
      )}

      {loading && analytics === null && <PageSkeleton />}

      {loading && analytics !== null && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Updating…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {analytics && dashboard && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="participants" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Participants
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participants">
            <ParticipantsTab analytics={analytics} dashboard={dashboard} />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTab analytics={analytics} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
