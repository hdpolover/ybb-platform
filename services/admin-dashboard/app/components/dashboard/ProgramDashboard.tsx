"use client";

import React, { useEffect, useState } from "react";
import { KPISection } from "./sections/KPISection";
import { TrendSection, TrendRange } from "./sections/TrendSection";
import { GenderSection } from "./sections/GenderSection";
import { AgeSection } from "./sections/AgeSection";
import { NationalitySection } from "./sections/NationalitySection";
import { TopAmbassadorsSection } from "./sections/TopAmbassadorsSection";
import { GenderDetailsModal } from "./modals/GenderDetailsModal";
import { AgeDetailsModal } from "./modals/AgeDetailsModal";
import { NationalityDetailsModal } from "./modals/NationalityDetailsModal";
import { AmbassadorsDetailsModal } from "./modals/AmbassadorsDetailsModal";
import {
  getProgramDashboardAnalytics,
  listProgramSupportTickets,
  type ProgramDashboardAnalytics,
  type ProgramSupportTicketSummary,
} from "@/src/shared/api-client";
import Link from "next/link";

type ProgramDashboardProps = {
  selectedProgramId: string;
};

export function ProgramDashboard({ selectedProgramId }: ProgramDashboardProps) {
  const [trendRange, setTrendRange] = useState<TrendRange>("daily");
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showNationalityModal, setShowNationalityModal] = useState(false);
  const [showAmbassadorModal, setShowAmbassadorModal] = useState(false);
  const [dashboardData, setDashboardData] = useState<ProgramDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTickets, setOpenTickets] = useState<ProgramSupportTicketSummary[]>([]);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [loadingTickets, setLoadingTickets] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchDashboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await getProgramDashboardAnalytics(selectedProgramId);
        if (!isMounted) return;
        setDashboardData(response);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, [selectedProgramId]);

  useEffect(() => {
    let isMounted = true;
    async function fetchOpenTickets() {
      setLoadingTickets(true);
      try {
        const response = await listProgramSupportTickets(selectedProgramId, { status: "open", limit: 5 });
        if (!isMounted) return;
        setOpenTickets(response.data ?? []);
        setOpenTicketCount(response.meta?.total ?? 0);
      } catch {
        // Non-critical — silently ignore
      } finally {
        if (isMounted) setLoadingTickets(false);
      }
    }
    void fetchOpenTickets();
    return () => {
      isMounted = false;
    };
  }, [selectedProgramId]);

  const trendDataByRange: Record<TrendRange, { label: string; registrations: number }[]> = {
    daily: dashboardData?.trend.daily ?? [],
    weekly: dashboardData?.trend.weekly ?? [],
    monthly: dashboardData?.trend.monthly ?? [],
  };

  const trendData = trendDataByRange[trendRange];

  const genderData = dashboardData?.gender ?? [];

  const genderColors = ["#2563eb", "#ec4899", "#6b7280"];

  const ageDistribution = dashboardData?.age ?? [];

  const nationalityData = dashboardData?.nationalities ?? [];

  const topAmbassadors = dashboardData?.topAmbassadors ?? [];

  const fallbackKpis: ProgramDashboardAnalytics["kpis"] = {
    registeredUsers: 0,
    registrationsToday: 0,
    formsStarted: 0,
    submittedApplications: 0,
    registeredOnly: 0,
    totalAmbassadors: 0,
    activeAmbassadors: 0,
    referredParticipants: 0,
    referredParticipantsPercent: 0,
    programStatus: "unknown",
    programStatusDate: null,
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <KPISection kpis={dashboardData?.kpis ?? fallbackKpis} loading={loading} />

      <section className="grid gap-4 md:grid-cols-2">
        <TrendSection
          trendRange={trendRange}
          onChangeTrendRange={setTrendRange}
          data={trendData}
        />
        <GenderSection
          data={genderData}
          colors={genderColors}
          onOpenDetails={() => setShowGenderModal(true)}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AgeSection
          data={ageDistribution}
          onOpenDetails={() => setShowAgeModal(true)}
        />
        <NationalitySection
          data={nationalityData}
          onOpenDetails={() => setShowNationalityModal(true)}
        />
      </section>
      <TopAmbassadorsSection
        data={topAmbassadors}
        onOpenDetails={() => setShowAmbassadorModal(true)}
      />

      <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Support Tickets</h3>
            <p className="text-xs text-zinc-500">
              {loadingTickets ? "Loading..." : `${openTicketCount} open ticket(s)`}
            </p>
          </div>
          <Link
            href={`/programs/${selectedProgramId}/support-tickets`}
            className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
          >
            View all
          </Link>
        </div>
        {!loadingTickets && openTickets.length === 0 ? (
          <p className="text-xs text-zinc-500">No open support tickets.</p>
        ) : null}
        {openTickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/programs/${selectedProgramId}/support-tickets`}
            className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-xs hover:bg-zinc-50 mb-2 last:mb-0"
          >
            <div className="min-w-0">
              <span className="font-medium text-zinc-700 mr-2">{ticket.ticketNumber}</span>
              <span className="truncate text-zinc-600">{ticket.subject}</span>
            </div>
            <span className="ml-3 shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
              {ticket.priority}
            </span>
          </Link>
        ))}
      </section>

      <GenderDetailsModal
        open={showGenderModal}
        onClose={() => setShowGenderModal(false)}
        data={genderData}
      />
      <AgeDetailsModal
        open={showAgeModal}
        onClose={() => setShowAgeModal(false)}
        data={ageDistribution}
      />
      <NationalityDetailsModal
        open={showNationalityModal}
        onClose={() => setShowNationalityModal(false)}
        data={nationalityData}
      />
      <AmbassadorsDetailsModal
        open={showAmbassadorModal}
        onClose={() => setShowAmbassadorModal(false)}
        data={topAmbassadors}
      />
    </div>
  );
}
