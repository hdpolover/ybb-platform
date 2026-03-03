// services/admin-dashboard/app/components/scoring/FullyFundedDetailsTabsCard.tsx
"use client";

import React, { useState } from "react";

const tabs = [
  "Personal Details",
  "Education & Experience",
  "Emergency Contact",
  "Essays",
  "Scores",
] as const;

type TabKey = (typeof tabs)[number];

interface FullyFundedDetailsTabsCardProps {
  hideScores?: boolean;
}

export function FullyFundedDetailsTabsCard({ hideScores }: FullyFundedDetailsTabsCardProps) {
  const visibleTabs: readonly TabKey[] = hideScores
    ? tabs.filter((tab) => tab !== "Scores")
    : tabs;

  const [activeTab, setActiveTab] = useState<TabKey>("Personal Details");

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Bagian Tab Navigation */}
      <div className="border-b border-zinc-200 bg-zinc-50/30 px-6">
        <nav className="-mb-px flex gap-6 overflow-x-auto text-sm no-scrollbar">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-6 md:p-8">
        {activeTab === "Personal Details" && <PersonalDetailsContent />}
        {activeTab === "Education & Experience" && <EducationExperienceContent />}
        {activeTab === "Emergency Contact" && <EmergencyContactContent />}
        {activeTab === "Essays" && <EssaysContent />}
        {!hideScores && activeTab === "Scores" && <ScoresContent />}
      </div>
    </section>
  );
}

function BadgeValue({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
      {value}
    </span>
  );
}

function PersonalDetailsContent() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section>
        <h3 className="mb-5 text-base font-semibold text-zinc-900">Personal Information</h3>
        <dl className="space-y-4">
          <Field label="Birth Date" value="25 Nov 2007" />
          <Field label="Gender" value="female" className="capitalize" />
          <Field label="Origin Address" value="Dhaka, munshiganj Bangladesh" />
          <Field label="Current Address" value="Block 2, Street 16, Building 10 Al-Ahmadi, Abu halifa Kuwait" />
          <Field label="T-Shirt Size" value="M" className="uppercase" />
          <Field label="Disease History" value="None" />
        </dl>
      </section>

      <section>
        <h3 className="mb-5 text-base font-semibold text-zinc-900">Social Media & Others</h3>
        <dl className="space-y-4">
          <Field label="Instagram" value="@af.rah_f13" />
          <Field label="Twibbon Link" value="N/A" />
          <Field label="Knowledge Source" value="instagram" className="capitalize" />
          <Field label="Source Account" value="" />
          <Field label="Account Created" value="18 Aug 2025 19:28" />
        </dl>
      </section>
    </div>
  );
}

function EducationExperienceContent() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section>
        <h3 className="mb-5 text-base font-semibold text-zinc-900">Education</h3>
        <dl className="space-y-4">
          <Field label="Education Level" value="Undergraduate" asBadge />
          <Field label="Major" value="International Relations" />
          <Field label="Institution" value="ABC International School" />
        </dl>
      </section>

      <section>
        <h3 className="mb-5 text-base font-semibold text-zinc-900">Experience & Achievements</h3>
        <dl className="space-y-4">
          <Field
            label="Organizations"
            value="Member of Youth Climate Action Network, Campus Debate Society"
          />
          <Field
            label="Experiences"
            value="Project lead for community clean-water campaign."
          />
          <Field
            label="Achievement"
            value="Top 10 Best Delegate, Model UN Ahmedabad 2023."
            asBadge
          />
          <Field label="Resume" value="resume_afrah.pdf" isLink />
        </dl>
      </section>
    </div>
  );
}

function EmergencyContactContent() {
  return (
    <section>
      <h3 className="mb-5 text-base font-semibold text-zinc-900">Emergency Contact Information</h3>
      <dl className="max-w-xl space-y-4">
        <Field label="Emergency Contact" value="Aziz Ahmed" />
        <Field label="Relation" value="Father" />
        <Field label="Phone Number" value="+91 98765 00000" />
      </dl>
    </section>
  );
}

function EssaysContent() {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-base font-semibold text-zinc-900">Selected Subtheme</h3>
        <p className="text-sm font-semibold text-zinc-900">
          SDG 13 – Climate Action: Youth-led community initiatives for resilient cities.
        </p>
      </section>

      <section>
        <h3 className="mb-5 text-base font-semibold text-zinc-900">Essay Responses</h3>
        <dl className="space-y-6">
          <Field
            label="Title of your essay"
            value="From Local Rivers to Global Action: Empowering Youth for Climate Resilience"
          />
          <Field
            label="Main Essay"
            value="As a youth leader, I initiated a cross-school collaboration to reduce single-use plastics in our local markets..."
          />
          <Field
            label="References"
            value="IPCC Youth Summary 2023, UNDP Youth Climate Report 2022."
          />
        </dl>
      </section>
    </div>
  );
}

function ScoresContent() {
  return (
    <section>
      <h3 className="mb-5 text-base font-semibold text-zinc-900">Scores Summary</h3>
      <dl className="max-w-xl space-y-4">
        <Field label="Score" value="89 / 100" />
        <Field label="Total" value="A-" asBadge />
        <Field label="Status" value="Recommended as Fully Funded" asBadge />
      </dl>
    </section>
  );
}

// Komponen Inti: Sudah dikonsistenkan mengikuti Design System
function Field({
  label,
  value,
  isLink,
  asBadge,
  className = "",
}: {
  label: string;
  value: string;
  isLink?: boolean;
  asBadge?: boolean;
  className?: string;
}) {
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
      <dt className="mt-0.5 text-xs font-medium text-zinc-500">
        {label}
      </dt>
      
      {asBadge ? (
        <dd className="mt-1 sm:mt-0">
          <BadgeValue value={value || "-"} />
        </dd>
      ) : (
        <dd
          className={`mt-1 text-sm font-semibold sm:mt-0 ${className} ${
            isLink ? "cursor-pointer text-blue-600 hover:underline" : "text-zinc-900"
          }`}
        >
          {value || "-"}
        </dd>
      )}
    </div>
  );
}