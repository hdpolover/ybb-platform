"use client";

import React, { useState } from "react";
import { programs } from "../navbar/ProgramSelect";
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

type ProgramDashboardProps = {
  selectedProgramId: string;
};

export function ProgramDashboard({ selectedProgramId }: ProgramDashboardProps) {
  const [trendRange, setTrendRange] = useState<TrendRange>("daily");
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showNationalityModal, setShowNationalityModal] = useState(false);
  const [showAmbassadorModal, setShowAmbassadorModal] = useState(false);

  const program = programs.find((p) => p.id === selectedProgramId) ?? null;

  if (!program) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
        Program tidak ditemukan. Silakan pilih program lain dari menu di atas.
      </div>
    );
  }

  const dailyData = [
    { label: "1 Nov", registrations: 42 },
    { label: "2 Nov", registrations: 58 },
    { label: "3 Nov", registrations: 73 },
    { label: "4 Nov", registrations: 61 },
    { label: "5 Nov", registrations: 95 },
    { label: "6 Nov", registrations: 82 },
    { label: "7 Nov", registrations: 77 },
  ];

  const weeklyData = [
    { label: "1–7 Nov", registrations: 210 },
    { label: "8–14 Nov", registrations: 320 },
    { label: "15–21 Nov", registrations: 280 },
    { label: "22–30 Nov", registrations: 340 },
  ];

  const monthlyData = [
    { label: "Jan", registrations: 420 },
    { label: "Feb", registrations: 510 },
    { label: "Mar", registrations: 610 },
    { label: "Apr", registrations: 580 },
  ];

  const trendDataByRange: Record<TrendRange, { label: string; registrations: number }[]> = {
    daily: dailyData,
    weekly: weeklyData,
    monthly: monthlyData,
  };

  const trendData = trendDataByRange[trendRange];

  const genderData = [
    { name: "Male", value: 320 },
    { name: "Female", value: 360 },
  ];

  const genderColors = ["#2563eb", "#ec4899", "#6b7280"];

  const ageDistribution = [
    { range: "17-20", count: 180 },
    { range: "21-24", count: 260 },
    { range: "25-28", count: 150 },
    { range: "29-32", count: 70 },
  ];

  const nationalityData = [
    { country: "Indonesia", count: 420 },
    { country: "Japan", count: 110 },
    { country: "Malaysia", count: 60 },
    { country: "Thailand", count: 45 },
    { country: "Others", count: 53 },
  ];

  const topAmbassadors = [
    { name: "Alya Putri", country: "Indonesia", referrals: 48 },
    { name: "Kenji Sato", country: "Japan", referrals: 37 },
    { name: "Nurul Huda", country: "Malaysia", referrals: 29 },
    { name: "Thanakorn Chai", country: "Thailand", referrals: 22 },
    { name: "Dimas Aji", country: "Indonesia", referrals: 19 },
    { name: "Siti Aisyah", country: "Indonesia", referrals: 17 },
    { name: "Rizky Maulana", country: "Indonesia", referrals: 15 },
  ];

  return (
    <div className="space-y-4">
      <KPISection />

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
