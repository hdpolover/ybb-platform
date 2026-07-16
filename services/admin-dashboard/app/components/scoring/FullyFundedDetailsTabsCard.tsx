// services/admin-dashboard/app/components/scoring/FullyFundedDetailsTabsCard.tsx
"use client";

import React, { useState } from "react";
import type { Application } from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

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
  application?: Application;
}

export function FullyFundedDetailsTabsCard({
  hideScores,
  application,
}: FullyFundedDetailsTabsCardProps) {
  const visibleTabs: readonly TabKey[] = hideScores
    ? tabs.filter((tab) => tab !== "Scores")
    : tabs;

  const [activeTab, setActiveTab] = useState<TabKey>("Personal Details");

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Tab Navigation */}
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
        {!hideScores && activeTab === "Scores" && (
          <ScoresContent
            scoreTotal={application?.scoreTotal}
            scoreStatus={application?.scoreStatus}
          />
        )}
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
    <div className="grid gap-10 md:grid-cols-2">
      <section>
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

      <section>
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
    <div className="grid gap-10 md:grid-cols-2">
      <section>
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

      <section>
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
    <section>
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

function EssaysContent({ application }: { application?: Application }) {
  if (application?.essays && application.essays.length > 0) {
    return (
      <div className="space-y-8">
        {application.essays.map((essay, idx) => (
          <section key={essay.id ?? idx}>
            <h3 className="mb-3 text-base font-semibold text-zinc-900">
              {essay.question}
            </h3>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">
              {essay.answer ?? "-"}
            </p>
          </section>
        ))}
      </div>
    );
  }

  if (application?.submissionForm?.sections) {
    const sections = application.submissionForm.sections;
    return (
      <div className="space-y-8">
        {sections.map((section, sIdx) => (
          <section key={sIdx}>
            {section.label && (
              <h3 className="mb-5 text-base font-semibold text-zinc-900">
                {section.label}
              </h3>
            )}
            <dl className="space-y-6">
              {section.fields?.map((field, fIdx) => (
                <Field
                  key={field.name ?? fIdx}
                  label={field.label ?? ""}
                  value={String(field.value ?? "")}
                />
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

function ScoresContent({
  scoreTotal,
  scoreStatus,
}: {
  scoreTotal?: number | null;
  scoreStatus?: string | null;
}) {
  if (scoreTotal == null && !scoreStatus) {
    return (
      <div className="text-sm text-zinc-500">
        This application has not been scored yet.
      </div>
    );
  }

  return (
    <section>
      <h3 className="mb-5 text-base font-semibold text-zinc-900">
        Scores Summary
      </h3>
      <dl className="max-w-xl space-y-4">
        {scoreTotal != null && (
          <Field label="Score Total" value={String(scoreTotal)} />
        )}
        {scoreStatus && (
          <Field label="Status" value={scoreStatus} asBadge />
        )}
      </dl>
    </section>
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
    <div className="flex flex-col sm:grid sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
      <dt className="mt-0.5 text-xs font-medium text-zinc-500">{label}</dt>

      {asBadge ? (
        <dd className="mt-1 sm:mt-0">
          <BadgeValue value={value || "-"} />
        </dd>
      ) : (
        <dd
          className={`mt-1 text-sm font-semibold sm:mt-0 ${className} ${
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
