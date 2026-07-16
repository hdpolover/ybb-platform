"use client";

import {
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";

export type AdminManagementHeaderProps = {
  programName: string;
  totalAdmins: number;
  activeAdmins: number;
  superAdmins: number;
  recentLogins: number;
};

export function AdminManagementHeader({
  programName,
  totalAdmins,
  activeAdmins,
  superAdmins,
  recentLogins,
}: AdminManagementHeaderProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-base">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
            <span>Settings</span>
          </div>
          <h1 className="text-base font-semibold text-zinc-900 md:text-lg">
            Administrator Management
          </h1>
          <p className="text-xs text-zinc-500 md:text-sm">
            Manage access, roles, and program assignments for admin users.
          </p>
          <p className="text-[11px] text-zinc-400 md:text-xs">
            Currently viewing administrators for: <span className="font-medium">{programName}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <div>
            <div className="text-[11px] font-medium text-zinc-500">Total Admins</div>
            <div className="text-lg font-semibold text-zinc-900 md:text-xl">{totalAdmins}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
            <UserGroupIcon className="h-5 w-5 text-blue-600" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <div>
            <div className="text-[11px] font-medium text-zinc-500">Active Admins</div>
            <div className="text-lg font-semibold text-emerald-700 md:text-xl">{activeAdmins}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <div>
            <div className="text-[11px] font-medium text-zinc-500">Super Admins</div>
            <div className="text-lg font-semibold text-zinc-900 md:text-xl">{superAdmins}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
            <ShieldCheckIcon className="h-5 w-5 text-amber-600" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <div>
            <div className="text-[11px] font-medium text-zinc-500">Recent Logins</div>
            <div className="text-lg font-semibold text-zinc-900 md:text-xl">{recentLogins}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100">
            <ClockIcon className="h-5 w-5 text-purple-600" />
          </div>
        </div>
      </div>
    </section>
  );
}
