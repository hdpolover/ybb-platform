// services/admin-dashboard/app/components/scoring/FullyFundedDetailsTabsCard.tsx
"use client";

import React, { useState } from "react";
import type { Application } from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

// "Scores" used to live here as a tab, but scoring now lives in the docked
// scoring panel next to this card (see the split-view participant detail
// page), so it was removed from this tab list.
const tabs = [
  "Personal Details",
  "Education & Experience",
  "Emergency Contact",
  "Essays",
] as const;

type TabKey = (typeof tabs)[number];

interface FullyFundedDetailsTabsCardProps {
  application?: Application;
}

export function FullyFundedDetailsTabsCard({
  application,
}: FullyFundedDetailsTabsCardProps) {
  // Essays is what a reviewer reads first, so it's the default tab now that
  // scoring happens alongside it in the docked panel.
  const [activeTab, setActiveTab] = useState<TabKey>("Essays");

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Tab Navigation. Wraps to a second row instead of scrolling: the
          pane is often too narrow at desktop widths for four tabs on one
          line, and a wrapped strip guarantees every label stays fully
          visible with no truncation and no scrollbar to style. */}
      <div className="border-b border-zinc-200 bg-zinc-50/30 px-6">
        <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {tabs.map((tab) => {
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

      {/* @container: this card lives in the left pane of a split view, not
          full page width, so tab content below sizes to ITS OWN box, not
          the viewport. Container query variants (@sm, @3xl, ...) replace
          viewport variants (sm:, md:) throughout the tab bodies. */}
      <div className="p-6 md:p-8 @container">
        {activeTab === "Personal Details" && (
          <PersonalDetailsContent application={application} />
        )}
        {activeTab === "Education & Experience" && (
          <EducationExperienceContent application={application} />
        )}
        {activeTab === "Emergency Contact" && (
          <EmergencyContactContent participant={application?.participant} />
        )}
        {activeTab === "Essays" && <EssaysContent application={application} />}
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

function PersonalDetailsContent({
  application,
}: {
  application?: Application;
}) {
  const p = application?.participant;

  const origin = [p?.originCity, p?.originCountry].filter(Boolean).join(", ");
  const currentAddress = [p?.currentCity, p?.currentCountry]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid gap-10 @3xl:grid-cols-2">
      <section className="@container min-w-0">
        <h3 className="mb-5 text-base font-semibold text-zinc-900">
          Personal Information
        </h3>
        <dl className="space-y-4">
          <Field
            label="Birth Date"
            value={p?.birthdate ? formatDate(p.birthdate) : ""}
          />
          <Field label="Gender" value={p?.gender ?? ""} className="capitalize" />
          <Field label="Origin Address" value={origin} />
          <Field label="Current Address" value={currentAddress} />
          <Field
            label="T-Shirt Size"
            value={p?.tshirtSize ?? ""}
            className="uppercase"
          />
          <Field label="Disease History" value={p?.medicalConditions ?? ""} />
        </dl>
      </section>

      <section className="@container min-w-0">
        <h3 className="mb-5 text-base font-semibold text-zinc-900">
          Social Media & Others
        </h3>
        <dl className="space-y-4">
          <Field label="Instagram" value={p?.instagramUsername ?? ""} />
          <Field
            label="Knowledge Source"
            value={p?.knowledgeSource ?? ""}
            className="capitalize"
          />
          <Field
            label="Account Created"
            value={
              application?.createdAt ? formatDate(application.createdAt) : ""
            }
          />
        </dl>
      </section>
    </div>
  );
}

function EducationExperienceContent({
  application,
}: {
  application?: Application;
}) {
  const p = application?.participant;

  return (
    <div className="grid gap-10 @3xl:grid-cols-2">
      <section className="@container min-w-0">
        <h3 className="mb-5 text-base font-semibold text-zinc-900">
          Education
        </h3>
        <dl className="space-y-4">
          <Field
            label="Education Level"
            value={p?.educationLevel ?? ""}
            asBadge
          />
          <Field label="Major" value={p?.major ?? ""} />
          <Field label="Institution" value={p?.institution ?? ""} />
        </dl>
      </section>

      <section className="@container min-w-0">
        <h3 className="mb-5 text-base font-semibold text-zinc-900">
          Experience & Achievements
        </h3>
        <dl className="space-y-4">
          <Field label="Organizations" value={p?.organizations ?? ""} />
          <Field label="Experiences" value={application?.experiences ?? ""} />
          <Field
            label="Achievement"
            value={application?.achievements ?? ""}
            asBadge
          />
          {p?.resumeUrl && (
            <Field label="Resume" value={p.resumeUrl} isLink />
          )}
        </dl>
      </section>
    </div>
  );
}

function EmergencyContactContent({
  participant,
}: {
  participant?: Application["participant"];
}) {
  if (!participant?.emergencyContactName) {
    return (
      <div className="text-sm text-zinc-500">
        Emergency contact information not provided.
      </div>
    );
  }

  const emergencyPhone = [
    participant.emergencyContactCountryCode,
    participant.emergencyContactPhone,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="@container min-w-0">
      <h3 className="mb-5 text-base font-semibold text-zinc-900">
        Emergency Contact Information
      </h3>
      <dl className="max-w-xl space-y-4">
        <Field
          label="Emergency Contact"
          value={participant.emergencyContactName}
        />
        <Field
          label="Relation"
          value={participant.emergencyContactRelation ?? ""}
        />
        <Field label="Phone Number" value={emergencyPhone} />
      </dl>
    </section>
  );
}

// Essay body typography: sized and measured for sustained reading (a
// reviewer works through 203 of these in one sitting), not the compact
// key-value density used elsewhere in this card. ~72ch caps the line length
// on wide screens; break-words guards against long unbroken tokens (URLs,
// pasted text with no spaces) forcing horizontal overflow.
const ESSAY_QUESTION_CLASS = "mb-4 mt-2 text-lg font-semibold tracking-tight text-zinc-900";
const ESSAY_BODY_CLASS =
  "whitespace-pre-wrap break-words text-[16px] leading-[1.7] text-zinc-700";

function EssaysContent({ application }: { application?: Application }) {
  if (application?.essays && application.essays.length > 0) {
    return (
      <div className="space-y-10">
        {application.essays.map((essay, idx) => (
          <section key={essay.id ?? idx} className="max-w-[72ch]">
            <h3 className={ESSAY_QUESTION_CLASS}>{essay.question}</h3>
            <p className={ESSAY_BODY_CLASS}>{essay.answer ?? "-"}</p>
          </section>
        ))}
      </div>
    );
  }

  if (application?.submissionForm?.sections) {
    const sections = application.submissionForm.sections;
    return (
      <div className="space-y-10">
        {sections.map((section, sIdx) => (
          <section key={sIdx} className="max-w-[72ch]">
            {section.label && <h3 className={ESSAY_QUESTION_CLASS}>{section.label}</h3>}
            <dl className="space-y-6">
              {section.fields?.map((field, fIdx) => (
                <div key={field.name ?? fIdx}>
                  <dt className="text-xs font-medium text-zinc-500">{field.label}</dt>
                  <dd className={`mt-1 ${ESSAY_BODY_CLASS}`}>
                    {String(field.value ?? "-")}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="text-sm text-zinc-500">No essay responses found.</div>
  );
}

// Core Field component, consistent with Design System
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
    <div className="flex min-w-0 flex-col @sm:grid @sm:grid-cols-[160px_1fr] @sm:items-start @sm:gap-4">
      <dt className="mt-0.5 text-xs font-medium text-zinc-500">{label}</dt>

      {asBadge ? (
        <dd className="mt-1 min-w-0 @sm:mt-0">
          <BadgeValue value={value || "-"} />
        </dd>
      ) : (
        <dd
          className={`mt-1 min-w-0 break-words text-sm font-semibold @sm:mt-0 ${className} ${
            isLink
              ? "cursor-pointer text-blue-600 hover:underline"
              : "text-zinc-900"
          }`}
        >
          {value || "-"}
        </dd>
      )}
    </div>
  );
}
