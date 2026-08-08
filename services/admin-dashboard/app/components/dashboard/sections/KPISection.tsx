"use client";

import React from "react";
import {
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  UserCircleIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";

type KPIData = {
  registeredUsers: number;
  registrationsToday: number;
  formsStarted: number;
  submittedApplications: number;
  registeredOnly: number;
  totalAmbassadors: number;
  activeAmbassadors: number;
  referredParticipants: number;
  referredParticipantsPercent: number;
  programStatus: string;
  programStatusDate: string | null;
};

interface KPISectionProps {
  /**
   * Null whenever there is no trustworthy data, including a failed fetch. It is
   * deliberately not defaulted to a zero-filled object: a row of clean "0"
   * cards reads as "nobody registered", which is indistinguishable from an
   * outage and is exactly how a real registration incident got misread.
   */
  kpis: KPIData | null;
  loading?: boolean;
}

function formatProgramStatus(status: string): string {
  if (!status) return "Unknown";
  return status
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatProgramStatusDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("sv-SE", { hour12: false }).replace("T", " ");
}

function formatShare(value: number, total: number): string {
  if (total <= 0) return "0.0% of registered";
  return `${((value / total) * 100).toFixed(1)}% of registered`;
}

export function KPISection({ kpis, loading = false }: KPISectionProps) {
  // A single narrowed source for every card: null while loading OR when the
  // fetch produced nothing, so no code path can print a fabricated 0.
  const data = loading ? null : kpis;

  const registrationsValue = data ? data.registeredUsers.toLocaleString() : "—";
  const registrationsTodayValue = data ? `${data.registrationsToday.toLocaleString()} today` : "—";
  const formsStartedValue = data ? data.formsStarted.toLocaleString() : "—";
  const formsStartedSubtitle = data ? formatShare(data.formsStarted, data.registeredUsers) : "—";
  const submittedApplicationsValue = data ? data.submittedApplications.toLocaleString() : "—";
  const submittedApplicationsSubtitle = data ? formatShare(data.submittedApplications, data.registeredUsers) : "—";
  const registeredOnlyValue = data ? data.registeredOnly.toLocaleString() : "—";
  const registeredOnlySubtitle = data ? formatShare(data.registeredOnly, data.registeredUsers) : "—";
  const ambassadorsValue = data ? data.totalAmbassadors.toLocaleString() : "—";
  const ambassadorSubtitle = data ? `${data.activeAmbassadors.toLocaleString()} active ambassadors` : "—";
  const referredParticipantsValue = data ? data.referredParticipants.toLocaleString() : "—";
  const referredPercentageValue = data ? `${data.referredParticipantsPercent.toFixed(1)}% of total` : "—";
  const programStatusValue = data ? formatProgramStatus(data.programStatus) : "—";
  const programStatusDateValue = data ? formatProgramStatusDate(data.programStatusDate) : "—";

  const cards = [
    {
      title: "Registered Users",
      value: registrationsValue,
      subtitle: registrationsTodayValue,
      subtitleClassName: "text-emerald-600",
      icon: <UserPlusIcon className="h-4 w-4" aria-hidden="true" />,
      iconClassName: "bg-blue-50 text-blue-500",
    },
    {
      title: "Forms Started",
      value: formsStartedValue,
      subtitle: formsStartedSubtitle,
      subtitleClassName: "text-zinc-500",
      icon: <ClipboardDocumentListIcon className="h-4 w-4" aria-hidden="true" />,
      iconClassName: "bg-indigo-50 text-indigo-500",
    },
    {
      title: "Submitted Applications",
      value: submittedApplicationsValue,
      subtitle: submittedApplicationsSubtitle,
      subtitleClassName: "text-zinc-500",
      icon: <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />,
      iconClassName: "bg-emerald-50 text-emerald-500",
    },
    {
      title: "Registered Only",
      value: registeredOnlyValue,
      subtitle: registeredOnlySubtitle,
      subtitleClassName: "text-zinc-500",
      icon: <UserCircleIcon className="h-4 w-4" aria-hidden="true" />,
      iconClassName: "bg-zinc-100 text-zinc-500",
    },
    {
      title: "Ambassadors",
      value: ambassadorsValue,
      subtitle: ambassadorSubtitle,
      subtitleClassName: "text-zinc-500",
      icon: <UsersIcon className="h-4 w-4" aria-hidden="true" />,
      iconClassName: "bg-emerald-50 text-emerald-500",
    },
    {
      title: "Referred Participants",
      value: referredParticipantsValue,
      subtitle: referredPercentageValue,
      subtitleClassName: "text-zinc-500",
      icon: <ArrowTrendingUpIcon className="h-4 w-4" aria-hidden="true" />,
      iconClassName: "bg-purple-50 text-purple-500",
    },
    {
      title: "Program Status",
      value: programStatusValue,
      subtitle: programStatusDateValue,
      subtitleClassName: "text-zinc-500",
      icon: <ClockIcon className="h-4 w-4" aria-hidden="true" />,
      iconClassName: "bg-amber-50 text-amber-500",
    },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm"
        >
          <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${card.iconClassName}`}>
            {card.icon}
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {card.title}
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900">{card.value}</div>
            <div className={`mt-1 text-xs ${card.subtitleClassName}`}>{card.subtitle}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
