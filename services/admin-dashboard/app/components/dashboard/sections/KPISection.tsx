"use client";

import React from "react";
import { UserGroupIcon, UsersIcon, ArrowTrendingUpIcon, ClockIcon } from "@heroicons/react/24/solid";

export function KPISection() {
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
          <div className="mt-2 text-2xl font-semibold text-zinc-900">688</div>
          <div className="mt-1 text-xs text-emerald-600">166 today</div>
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
          <div className="mt-2 text-2xl font-semibold text-zinc-900">59</div>
          <div className="mt-1 text-xs text-zinc-500">Active ambassadors</div>
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
          <div className="mt-2 text-2xl font-semibold text-zinc-900">0</div>
          <div className="mt-1 text-xs text-zinc-500">0% of total</div>
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
          <div className="mt-2 text-2xl font-semibold text-zinc-900">Active</div>
          <div className="mt-1 text-xs text-zinc-500">2026-05-11 00:00:00</div>
        </div>
      </div>
    </section>
  );
}
