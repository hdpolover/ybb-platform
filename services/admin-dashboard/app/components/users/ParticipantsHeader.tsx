"use client";

import React from "react";
import { UserIcon, UsersIcon, BanknotesIcon } from "@heroicons/react/24/solid";

export function ParticipantsHeader() {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <UserIcon className="h-4 w-4" />
            </span>
            <span>Participants Overview</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Snapshot of participant distribution for the selected program.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Total Participants
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <UsersIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">1,275</div>
          <div className="mt-1 text-[11px] text-zinc-500">
            1,272 new in last 30 days
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Fully Funded
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <BanknotesIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">1,212</div>
          <div className="mt-1 text-[11px] text-zinc-500">95.1% of participants</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Self Funded
            </div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
              <UserIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">63</div>
          <div className="mt-1 text-[11px] text-zinc-500">4.9% of participants</div>
        </div>
      </div>
    </section>
  );
}
