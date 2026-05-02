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
import { getProgramDashboardAnalytics, type ProgramDashboardAnalytics } from "@/src/shared/api-client";

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
    totalParticipants: 0,
    participantsToday: 0,
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
