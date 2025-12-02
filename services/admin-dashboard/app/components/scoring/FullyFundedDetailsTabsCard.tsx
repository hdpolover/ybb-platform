"use client";

import React, { useState } from "react";
import {
  UserIcon,
  AcademicCapIcon,
  PhoneArrowDownLeftIcon,
  PencilSquareIcon,
  ChartBarIcon,
} from "@heroicons/react/24/solid";

const tabs = [
  "Personal Details",
  "Education & Experience",
  "Emergency Contact",
  "Essays",
  "Scores",
] as const;

type TabKey = (typeof tabs)[number];

function TabIcon({ tab }: { tab: TabKey }) {
  if (tab === "Personal Details") return <UserIcon className="h-3.5 w-3.5" />;
  if (tab === "Education & Experience") return <AcademicCapIcon className="h-3.5 w-3.5" />;
  if (tab === "Emergency Contact") return <PhoneArrowDownLeftIcon className="h-3.5 w-3.5" />;
  if (tab === "Essays") return <PencilSquareIcon className="h-3.5 w-3.5" />;
  return <ChartBarIcon className="h-3.5 w-3.5" />;
}

interface FullyFundedDetailsTabsCardProps {
  hideScores?: boolean;
}

export function FullyFundedDetailsTabsCard({ hideScores }: FullyFundedDetailsTabsCardProps) {
  const visibleTabs: readonly TabKey[] = hideScores
    ? tabs.filter((tab) => tab !== "Scores")
    : tabs;

  const [activeTab, setActiveTab] = useState<TabKey>("Personal Details");

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
      <div className="border-b border-zinc-200 pb-2">
        <nav className="flex flex-wrap gap-2 text-xs md:text-sm">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors md:text-xs ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  <TabIcon tab={tab} />
                </span>
                <span>{tab}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 text-xs text-zinc-700 md:text-sm">
        {activeTab === "Personal Details" && <PersonalDetailsContent />}
        {activeTab === "Education & Experience" && <EducationExperienceContent />}
        {activeTab === "Emergency Contact" && <EmergencyContactContent />}
        {activeTab === "Essays" && <EssaysContent />}
        {!hideScores && activeTab === "Scores" && <ScoresContent />}
      </div>
    </section>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center rounded-full bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
      {label}
    </div>
  );
}

function BadgeValue({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
      {value}
    </span>
  );
}

function PersonalDetailsContent() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <SectionTitle label="Personal Information" />
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Birth Date" value="12 March 2004" />
            <Field label="Gender" value="Female" />
            <Field label="Origin Address" value="Ahmedabad, Gujarat, India" />
            <Field label="Current Address" value="Ahmedabad, Gujarat, India" />
            <Field label="T-Shirt Size" value="M" asBadge />
            <Field label="Disease History" value="-" />
          </dl>
        </section>

        <section>
          <SectionTitle label="Social Media & Others" />
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Instagram" value="@samyia.azizahmed" />
            <Field label="Twibbon Link" value="https://twb.nz/jys-2026-samyia" isLink />
            <Field label="Knowledge Source" value="Instagram" />
            <Field label="Source Account" value="@youthbreaktheboundaries" />
            <Field label="Account Created" value="21 August 2024, 14:32 GMT+7" />
          </dl>
        </section>
      </div>
    </div>
  );
}

function EducationExperienceContent() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <SectionTitle label="Education" />
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Education Level" value="Undergraduate" asBadge />
            <Field label="Major" value="International Relations" />
            <Field label="Institution / Occupation" value="ABC International School" />
          </dl>
        </section>

        <section>
          <SectionTitle label="Experience & Achievements" />
          <dl className="mt-3 space-y-3">
            <Field
              label="Organizations"
              value="Member of Youth Climate Action Network, Campus Debate Society"
            />
            <Field
              label="Experiences"
              value="Project lead for community clean-water campaign (2023), volunteer tutor for underprivileged students (2022–2024)."
            />
            <Field
              label="Achievement"
              value="Top 10 Best Delegate, Model United Nations Ahmedabad 2023."
              asBadge
            />
            <Field label="Resume" value="resume_samyia_jys2026.pdf" isLink />
          </dl>
        </section>
      </div>
    </div>
  );
}

function EmergencyContactContent() {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
        Emergency Contact Information
      </h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Field label="Emergency Contact" value="Aziz Ahmed" />
        <Field label="Relation" value="Father" />
        <Field label="Phone Number" value="+91 98765 00000" />
      </dl>
    </section>
  );
}

function EssaysContent() {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
          Selected Subtheme
        </h3>
        <p className="text-sm text-zinc-800">
          SDG 13 – Climate Action: Youth-led community initiatives for resilient cities.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
          Essay Responses
        </h3>
        <dl className="space-y-3">
          <Field
            label="Title of your essay"
            value="From Local Rivers to Global Action: Empowering Youth for Climate Resilience"
          />
          <Field
            label="Main Essay"
            value="As a youth leader, I initiated a cross-school collaboration to reduce single-use plastics in our local markets, combining awareness campaigns, community clean-up events, and partnership with small businesses. Over the next year, I plan to expand this initiative by working with local government to introduce youth-designed guidelines for sustainable practices in public schools and community centers."
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
      <SectionTitle label="Scores Summary" />
      <dl className="mt-3 grid grid-cols-3 gap-x-6 gap-y-3">
        <Field label="Score" value="89 / 100" />
        <Field label="Total" value="A-" asBadge />
        <Field label="Status" value="Recommended as Fully Funded" asBadge />
      </dl>
    </section>
  );
}

function Field({
  label,
  value,
  isLink,
  asBadge,
}: {
  label: string;
  value: string;
  isLink?: boolean;
  asBadge?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</dt>
      {asBadge ? (
        <dd className="mt-0.5 text-sm font-semibold text-zinc-900">
          <BadgeValue value={value} />
        </dd>
      ) : (
        <dd
          className={`mt-0.5 text-sm font-semibold ${
            isLink ? "cursor-pointer text-blue-600 hover:underline" : "text-zinc-900"
          }`}
        >
          {value}
        </dd>
      )}
    </div>
  );
}
