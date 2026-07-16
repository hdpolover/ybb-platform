"use client";

import { PowerIcon, UserGroupIcon } from "@heroicons/react/24/solid";

export type MainConfigurationHeaderProps = {
  programName: string;
  programStatusLabel: string;
  registrationStatusLabel: string;
};

export function MainConfigurationHeader({
  programName,
  programStatusLabel,
  registrationStatusLabel,
}: MainConfigurationHeaderProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
            <span>Settings</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Currently Configuring
            </p>
            <h1 className="text-base font-semibold text-zinc-900 md:text-lg">
              {programName || "Selected Program"}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:items-center md:justify-end">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
            <PowerIcon className="h-4 w-4" />
            <span>Program Status:</span>
            <span className="font-semibold">{programStatusLabel}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
            <UserGroupIcon className="h-4 w-4" />
            <span>Registration:</span>
            <span className="font-semibold">{registrationStatusLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
