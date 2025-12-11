"use client";

import { UserCircleIcon, UsersIcon } from "@heroicons/react/24/solid";
import { getSpeakerStats, mockSpeakers } from "./ProgramSpeakersList";

export function ProgramSpeakersHeader() {
  const { totalSpeakers, totalKeynote, totalRegular, totalWithSession } = getSpeakerStats(mockSpeakers);

  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <UsersIcon className="h-4 w-4" />
            </span>
            <span>Program Speakers Overview</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Overview of all keynote and regular speakers, their profiles, and assigned sessions for
            this program.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Total Speakers
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <UserCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">{totalSpeakers}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Registered for this program</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Keynote Speakers
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <UserCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">{totalKeynote}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Highlight sessions &amp; keynotes</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Regular Speakers
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
              <UserCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">{totalRegular}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Workshops, panels, and sessions</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              With Sessions
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <UserCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">{totalWithSession}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Speakers already assigned to a session</div>
        </div>
      </div>
    </section>
  );
}
