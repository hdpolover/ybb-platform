"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { KPISection } from "./sections/KPISection";
import {
  getProgramDashboardAnalytics,
  listProgramSupportTickets,
  listApplications,
  listProgramInvoices,
  listProgramTimeline,
  type ProgramDashboardAnalytics,
  type ProgramSupportTicketSummary,
  type Application,
  type InvoiceSummary,
  type ProgramTimeline,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import Link from "next/link";

type ProgramDashboardProps = {
  selectedProgramId: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCountdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  if (days < 7) return `in ${days} days`;
  if (days < 14) return "in 1 week";
  const weeks = Math.floor(days / 7);
  if (days < 30) return `in ${weeks} weeks`;
  const months = Math.floor(days / 30);
  return `in ${months} month${months === 1 ? "" : "s"}`;
}

// ---- Shared card primitives ----

function CardHeader({
  title,
  badge,
  href,
}: {
  title: string;
  badge?: string | number;
  href: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {badge !== undefined && badge !== null && (
          <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {badge}
          </span>
        )}
      </div>
      <Link
        href={href}
        className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        View all
      </Link>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-zinc-400 py-2">{text}</p>;
}

function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-zinc-100" />
      ))}
    </div>
  );
}

function OperationalCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      {children}
    </section>
  );
}

// ---- Widget: Applications Awaiting Review ----

type ApplicationsWidgetProps = {
  programId: string;
  selectedProgramId: string;
};

function ApplicationsWidget({ programId, selectedProgramId }: ApplicationsWidgetProps) {
  const [submissions, setSubmissions] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listApplications({
        programId,
        status: "submitted",
        sortBy: "updatedAt",
        sortOrder: "desc",
        limit: 5,
      });
      setSubmissions(res.data);
      setTotal(res.total);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void fetchSubmissions();
  }, [fetchSubmissions]);

  return (
    <OperationalCard>
      <CardHeader
        title="Awaiting Review"
        badge={total > 0 ? total : undefined}
        href={`/programs/${selectedProgramId}/submissions?status=submitted`}
      />
      {loading ? (
        <LoadingRows />
      ) : submissions.length === 0 ? (
        <EmptyNote text="No applications awaiting review." />
      ) : (
        <ul className="space-y-1.5">
          {submissions.map((app) => (
            <li key={app.id}>
              <Link
                href={`/programs/${selectedProgramId}/submissions?applicationId=${app.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 text-xs hover:bg-zinc-50 transition-colors"
              >
                <span className="font-medium text-zinc-700 truncate min-w-0">
                  {app.participant?.fullName ?? "Unknown participant"}
                </span>
                <span className="ml-3 shrink-0 text-zinc-400">{timeAgo(app.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!loading && total > 5 && (
        <p className="mt-2 text-[11px] text-zinc-400">+{total - 5} more waiting</p>
      )}
    </OperationalCard>
  );
}

// ---- Widget: Payments Needing Attention ----

type PaymentsWidgetProps = {
  programId: string;
  selectedProgramId: string;
};

type PaymentAttentionCounts = {
  processing: number;
  unpaid: number;
  failed: number;
  outstandingAmount: number;
  currency: string;
};

function PaymentsWidget({ programId, selectedProgramId }: PaymentsWidgetProps) {
  const [counts, setCounts] = useState<PaymentAttentionCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProgramInvoices({ programId, limit: 1 });
      const summary = res.summary as InvoiceSummary;
      const processing = summary?.processing?.count ?? 0;
      const unpaid = summary?.unpaid?.count ?? 0;
      const failed = summary?.failed?.count ?? 0;
      const outstandingAmount = res.metrics?.outstandingAmount ?? 0;
      const currency = res.data[0]?.currency ?? "USD";
      setCounts({ processing, unpaid, failed, outstandingAmount, currency });
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  const totalNeedingAction =
    (counts?.processing ?? 0) + (counts?.unpaid ?? 0) + (counts?.failed ?? 0);

  return (
    <OperationalCard>
      <CardHeader
        title="Payments Needing Attention"
        badge={totalNeedingAction > 0 ? totalNeedingAction : undefined}
        href={`/programs/${selectedProgramId}/payments`}
      />
      {loading ? (
        <LoadingRows count={2} />
      ) : counts === null ? (
        <EmptyNote text="Could not load payment data." />
      ) : totalNeedingAction === 0 ? (
        <EmptyNote text="All payments are up to date." />
      ) : (
        <div className="space-y-2">
          {counts.unpaid > 0 && (
            <Link
              href={`/programs/${selectedProgramId}/payments?status=unpaid`}
              className="flex items-center justify-between rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs hover:bg-amber-100 transition-colors"
            >
              <span className="font-medium text-amber-800">Unpaid</span>
              <span className="font-semibold text-amber-900">{counts.unpaid}</span>
            </Link>
          )}
          {counts.processing > 0 && (
            <Link
              href={`/programs/${selectedProgramId}/payments?status=processing`}
              className="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs hover:bg-blue-100 transition-colors"
            >
              <span className="font-medium text-blue-800">Processing</span>
              <span className="font-semibold text-blue-900">{counts.processing}</span>
            </Link>
          )}
          {counts.failed > 0 && (
            <Link
              href={`/programs/${selectedProgramId}/payments?status=failed`}
              className="flex items-center justify-between rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs hover:bg-red-100 transition-colors"
            >
              <span className="font-medium text-red-800">Failed</span>
              <span className="font-semibold text-red-900">{counts.failed}</span>
            </Link>
          )}
          {counts.outstandingAmount > 0 && (
            <p className="text-[11px] text-zinc-500 pt-1">
              {counts.currency} {counts.outstandingAmount.toLocaleString()} outstanding
            </p>
          )}
        </div>
      )}
    </OperationalCard>
  );
}

// ---- Widget: Recent Registrations ----

type RecentRegistrationsWidgetProps = {
  programId: string;
  selectedProgramId: string;
};

function RecentRegistrationsWidget({
  programId,
  selectedProgramId,
}: RecentRegistrationsWidgetProps) {
  const [registrations, setRegistrations] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listApplications({
        programId,
        sortBy: "createdAt",
        sortOrder: "desc",
        limit: 5,
      });
      setRegistrations(res.data);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void fetchRegistrations();
  }, [fetchRegistrations]);

  return (
    <OperationalCard>
      <CardHeader
        title="Recent Registrations"
        href={`/programs/${selectedProgramId}/participants`}
      />
      {loading ? (
        <LoadingRows />
      ) : registrations.length === 0 ? (
        <EmptyNote text="No registrations yet." />
      ) : (
        <ul className="space-y-1.5">
          {registrations.map((app) => (
            <li key={app.id}>
              <Link
                href={`/programs/${selectedProgramId}/participants?applicationId=${app.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 text-xs hover:bg-zinc-50 transition-colors"
              >
                <span className="font-medium text-zinc-700 truncate min-w-0">
                  {app.participant?.fullName ?? "Unknown participant"}
                </span>
                <span className="ml-3 shrink-0 text-zinc-400">{timeAgo(app.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OperationalCard>
  );
}

// ---- Widget: Registration Deadline Countdown ----

type DeadlineWidgetProps = {
  programId: string;
  selectedProgramId: string;
};

type UpcomingMilestone = {
  title: string;
  date: string;
  daysUntilDate: number;
};

function DeadlineWidget({ programId, selectedProgramId }: DeadlineWidgetProps) {
  const [milestones, setMilestones] = useState<UpcomingMilestone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const timelines: ProgramTimeline[] = await listProgramTimeline(programId);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const upcoming = timelines
        .filter((t) => {
          const d = new Date(t.date);
          d.setHours(0, 0, 0, 0);
          return d >= now;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 3)
        .map((t) => ({
          title: t.title,
          date: t.date,
          daysUntilDate: daysUntil(t.date),
        }));
      setMilestones(upcoming);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  return (
    <OperationalCard>
      <CardHeader
        title="Upcoming Milestones"
        href={`/programs/${selectedProgramId}/master-data/timelines`}
      />
      {loading ? (
        <LoadingRows count={2} />
      ) : milestones.length === 0 ? (
        <EmptyNote text="No upcoming milestones." />
      ) : (
        <ul className="space-y-2">
          {milestones.map((m, i) => {
            const urgency =
              m.daysUntilDate <= 3
                ? "border-red-100 bg-red-50"
                : m.daysUntilDate <= 7
                  ? "border-amber-100 bg-amber-50"
                  : "border-zinc-100 bg-zinc-50";
            const textColor =
              m.daysUntilDate <= 3
                ? "text-red-800"
                : m.daysUntilDate <= 7
                  ? "text-amber-800"
                  : "text-zinc-700";
            const countdownColor =
              m.daysUntilDate <= 3
                ? "text-red-600 font-semibold"
                : m.daysUntilDate <= 7
                  ? "text-amber-600 font-semibold"
                  : "text-zinc-500";
            return (
              <li
                key={i}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${urgency}`}
              >
                <span className={`font-medium truncate min-w-0 ${textColor}`}>{m.title}</span>
                <span className={`ml-3 shrink-0 ${countdownColor}`}>
                  {formatCountdown(m.daysUntilDate)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </OperationalCard>
  );
}

// ---- Widget: Support Tickets ----

type SupportTicketsWidgetProps = {
  selectedProgramId: string;
  openTickets: ProgramSupportTicketSummary[];
  openTicketCount: number;
  loading: boolean;
};

function SupportTicketsWidget({
  selectedProgramId,
  openTickets,
  openTicketCount,
  loading,
}: SupportTicketsWidgetProps) {
  return (
    <OperationalCard>
      <CardHeader
        title="Open Support Tickets"
        badge={openTicketCount > 0 ? openTicketCount : undefined}
        href={`/programs/${selectedProgramId}/support-tickets`}
      />
      {loading ? (
        <LoadingRows />
      ) : openTickets.length === 0 ? (
        <EmptyNote text="No open support tickets." />
      ) : (
        <ul className="space-y-1.5">
          {openTickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/programs/${selectedProgramId}/support-tickets?ticket=${ticket.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 text-xs hover:bg-zinc-50 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="shrink-0 font-semibold text-zinc-500">
                    {ticket.ticketNumber}
                  </span>
                  <span className="truncate text-zinc-600">{ticket.subject}</span>
                </div>
                <span
                  className={`ml-3 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    ticket.priority === "urgent"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : ticket.priority === "high"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  }`}
                >
                  {ticket.priority}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OperationalCard>
  );
}

// ---- Root component ----

export function ProgramDashboard({ selectedProgramId }: ProgramDashboardProps) {
  const [dashboardData, setDashboardData] = useState<ProgramDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTickets, setOpenTickets] = useState<ProgramSupportTicketSummary[]>([]);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // selectedProgramId may be a program slug; operational APIs need the UUID.
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useMemo(() => {
    const match = accessiblePrograms.find(
      (program) =>
        program.programId === selectedProgramId || program.programSlug === selectedProgramId,
    );
    return match?.programId ?? selectedProgramId;
  }, [accessiblePrograms, selectedProgramId]);

  // KPI data (feeds the top stat strip)
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getProgramDashboardAnalytics(resolvedProgramId);
      setDashboardData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // Support tickets (pre-fetched here to pass count as badge)
  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const response = await listProgramSupportTickets(resolvedProgramId, {
        status: "open",
        limit: 5,
      });
      setOpenTickets(response.data ?? []);
      setOpenTicketCount(response.meta?.total ?? 0);
    } catch {
      // Non-critical
    } finally {
      setLoadingTickets(false);
    }
  }, [resolvedProgramId]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI pulse strip */}
      <KPISection kpis={dashboardData?.kpis ?? null} loading={loading} />

      {/* Operational command center */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ApplicationsWidget
          programId={resolvedProgramId}
          selectedProgramId={selectedProgramId}
        />
        <PaymentsWidget
          programId={resolvedProgramId}
          selectedProgramId={selectedProgramId}
        />
        <RecentRegistrationsWidget
          programId={resolvedProgramId}
          selectedProgramId={selectedProgramId}
        />
        <DeadlineWidget
          programId={resolvedProgramId}
          selectedProgramId={selectedProgramId}
        />
        <SupportTicketsWidget
          selectedProgramId={selectedProgramId}
          openTickets={openTickets}
          openTicketCount={openTicketCount}
          loading={loadingTickets}
        />
      </div>
    </div>
  );
}
