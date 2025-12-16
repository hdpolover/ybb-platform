"use client";

import type { AdminRow, AdminRole, AdminStatus } from "../AdminManagement";
import {
  AdjustmentsHorizontalIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  UserIcon,
} from "@heroicons/react/24/solid";

export type AdminManagementTableProps = {
  admins: AdminRow[];
  roleFilter: AdminRole | "All Roles";
  onChangeRoleFilter: (value: AdminRole | "All Roles") => void;
  programFilter: string | "All Programs";
  onChangeProgramFilter: (value: string | "All Programs") => void;
  statusFilter: AdminStatus | "All Status";
  onChangeStatusFilter: (value: AdminStatus | "All Status") => void;
  search: string;
  onChangeSearch: (value: string) => void;
  allPrograms: string[];
  onAddAdmin: () => void;
  onViewAdmin: (admin: AdminRow) => void;
  onEditAdmin: (admin: AdminRow) => void;
  onResetPassword: (admin: AdminRow) => void;
  onDeleteAdmin: (admin: AdminRow) => void;
};

export function AdminManagementTable({
  admins,
  roleFilter,
  onChangeRoleFilter,
  programFilter,
  onChangeProgramFilter,
  statusFilter,
  onChangeStatusFilter,
  search,
  onChangeSearch,
  allPrograms,
  onAddAdmin,
  onViewAdmin,
  onEditAdmin,
  onResetPassword,
  onDeleteAdmin,
}: AdminManagementTableProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-sm">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">
            Administrator Management
          </h2>
          <p className="text-[11px] text-zinc-500 md:text-xs">
            Add, filter, and manage admin accounts across programs.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={onAddAdmin}
        >
          <UserIcon className="h-4 w-4" />
          <span>Add Administrator</span>
        </button>
      </div>

      {/* Bagian filter dan kolom search admin */}
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="grid w-full gap-2 md:grid-cols-3 md:gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Role
            </label>
            <select
              value={roleFilter}
              onChange={(event) =>
                onChangeRoleFilter(event.target.value as AdminRole | "All Roles")
              }
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:text-xs"
            >
              <option value="All Roles">All Roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Project Manager">Project Manager</option>
              <option value="Tnd">Tnd</option>
              <option value="Reviewer">Reviewer</option>
              <option value="Ambassador Coordinator">Ambassador Coordinator</option>
              <option value="Mentor">Mentor</option>
              <option value="News Writer">News Writer</option>
              <option value="Digital Marketing">Digital Marketing</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Program
            </label>
            <select
              value={programFilter}
              onChange={(event) =>
                onChangeProgramFilter(event.target.value as string | "All Programs")
              }
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:text-xs"
            >
              <option value="All Programs">All Programs</option>
              {allPrograms.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                onChangeStatusFilter(event.target.value as AdminStatus | "All Status")
              }
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:text-xs"
            >
              <option value="All Status">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">
            Search
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-zinc-400">
              <MagnifyingGlassIcon className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(event) => onChangeSearch(event.target.value)}
              placeholder="Search by name, email, role, or program..."
              className="block w-full rounded-md border border-zinc-200 bg-white px-8 py-2 text-[11px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tabel daftar administrator */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[11px] md:text-xs">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">No.</th>
              <th className="px-3 py-2">Admin</th>
              <th className="px-3 py-2">Details</th>
              <th className="px-3 py-2">Programs</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last Login</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-[11px] text-zinc-500"
                >
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No administrators found</span>
                    <span className="text-[10px] text-zinc-400">
                      Adjust filters or add a new administrator.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              admins.map((admin, index) => (
                <tr
                  key={admin.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-3 py-2 align-top text-[10px] text-zinc-500">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700">
                          {admin.name
                            .split(" ")
                            .map((part) => part.charAt(0))
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-900 md:text-xs">
                          {admin.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <EnvelopeIcon className="h-3 w-3" />
                        <span>{admin.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-0.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-700 ring-1 ring-zinc-200">
                        <AdjustmentsHorizontalIcon className="h-3 w-3" />
                        <span>{admin.role}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-[10px] text-zinc-700">
                    <div className="flex flex-wrap gap-1">
                      {admin.programs.slice(0, 2).map((program) => (
                        <span
                          key={program}
                          className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-100"
                        >
                          {program}
                        </span>
                      ))}
                      {admin.programs.length > 2 && (
                        <span className="inline-flex items-center rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-zinc-200">
                          +{admin.programs.length - 2} more programs
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        admin.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                          : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200"
                      }`}
                    >
                      {admin.status === "Active" ? (
                        <CheckCircleIcon className="h-3 w-3" />
                      ) : (
                        <ClockIcon className="h-3 w-3" />
                      )}
                      <span>{admin.status}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-[10px] text-zinc-600">
                    {admin.lastLogin}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100"
                        aria-label="View details"
                        onClick={() => onViewAdmin(admin)}
                      >
                        <UserIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        aria-label="Edit administrator"
                        onClick={() => onEditAdmin(admin)}
                      >
                        <AdjustmentsHorizontalIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-purple-200 bg-purple-50 text-purple-700 shadow-sm hover:bg-purple-100"
                        aria-label="Reset password"
                        onClick={() => onResetPassword(admin)}
                      >
                        <KeyIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        aria-label="Delete administrator"
                        onClick={() => onDeleteAdmin(admin)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
