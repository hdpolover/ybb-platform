"use client";

import React from "react";
import { UserGroupIcon, UsersIcon, ArrowTrendingUpIcon, ClockIcon } from "@heroicons/react/24/solid";

type KPIData = {
  totalParticipants: number;
  participantsToday: number;
  totalAmbassadors: number;
  activeAmbassadors: number;
  referredParticipants: number;
  referredParticipantsPercent: number;
  programStatus: string;
  programStatusDate: string | null;
};

interface KPISectionProps {
  kpis: KPIData;
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

export function KPISection({ kpis, loading = false }: KPISectionProps) {
  const participantsValue = loading ? "—" : kpis.totalParticipants.toLocaleString();
  const participantsTodayValue = loading ? "—" : `${kpis.participantsToday.toLocaleString()} today`;
  const ambassadorsValue = loading ? "—" : kpis.totalAmbassadors.toLocaleString();
  const ambassadorSubtitle = loading ? "—" : `${kpis.activeAmbassadors.toLocaleString()} active ambassadors`;
  const referredParticipantsValue = loading ? "—" : kpis.referredParticipants.toLocaleString();
  const referredPercentageValue = loading ? "—" : `${kpis.referredParticipantsPercent.toFixed(1)}% of total`;
  const programStatusValue = loading ? "—" : formatProgramStatus(kpis.programStatus);
  const programStatusDateValue = loading ? "—" : formatProgramStatusDate(kpis.programStatusDate);

  return (
    <section className="grid gap-3 md:grid-cols-4">
      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500">
          <UserGroupIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Total Participants
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">{participantsValue}</div>
          <div className="mt-1 text-xs text-emerald-600">{participantsTodayValue}</div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
          <UsersIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Ambassadors
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">{ambassadorsValue}</div>
          <div className="mt-1 text-xs text-zinc-500">{ambassadorSubtitle}</div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-purple-500">
          <ArrowTrendingUpIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Referred Participants
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">{referredParticipantsValue}</div>
          <div className="mt-1 text-xs text-zinc-500">{referredPercentageValue}</div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <ClockIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Program Status
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">{programStatusValue}</div>
          <div className="mt-1 text-xs text-zinc-500">{programStatusDateValue}</div>
        </div>
      </div>
    </section>
  );
}
