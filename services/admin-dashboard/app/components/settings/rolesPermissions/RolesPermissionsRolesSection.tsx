"use client";

import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, EyeIcon } from "@heroicons/react/24/solid";
import type { RoleRow, PermissionCategory } from "../RolesPermissionsSettings";

export type RolesPermissionsRolesSectionProps = {
  roles: RoleRow[];
  search: string;
  onChangeSearch: (value: string) => void;
  onCreateRole: () => void;
  onViewRole: (role: RoleRow) => void;
  onEditRole: (role: RoleRow) => void;
  onDeleteRole: (role: RoleRow) => void;
};

export function RolesPermissionsRolesSection({
  roles,
  search,
  onChangeSearch,
  onCreateRole,
  onViewRole,
  onEditRole,
  onDeleteRole,
}: RolesPermissionsRolesSectionProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm md:px-5 md:py-4 md:text-sm">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-zinc-900 md:text-base">Roles &amp; Permission</h2>
          <p className="text-[11px] text-zinc-500 md:text-xs">
            Tip: Click on any role row to view detailed information, or use the action buttons for
            specific operations.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 md:text-sm"
          onClick={onCreateRole}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-blue-600">
            +
          </span>
          <span>Create Role</span>
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-[11px] text-zinc-500">
          Manage role definitions and how permissions are grouped for this program.
        </div>
        <div className="w-full md:max-w-xs">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">Search</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-zinc-400">
              <MagnifyingGlassIcon className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(event) => onChangeSearch(event.target.value)}
              placeholder="Search by role name or display name..."
              className="block w-full rounded-md border border-zinc-200 bg-white px-8 py-2 text-[11px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:text-xs"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[11px] md:text-xs">
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <th className="w-10 px-3 py-2">No.</th>
              <th className="px-3 py-2">Role Name</th>
              <th className="px-3 py-2">Display Name</th>
              <th className="px-3 py-2">Permissions</th>
              <th className="px-3 py-2">Users</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-[11px] text-zinc-500"
                >
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="inline-block h-8 w-8 rounded-full border border-dashed border-zinc-300" />
                    <span className="font-medium">No roles found</span>
                    <span className="text-[10px] text-zinc-400">
                      Adjust search or create a new role.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              roles.map((role, index) => (
                <tr
                  key={role.id}
                  className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50"
                  onClick={() => onViewRole(role)}
                >
                  <td className="px-3 py-2 align-top text-[10px] text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-semibold text-zinc-900 md:text-xs">
                        {role.roleName}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] text-zinc-700 md:text-xs">
                    {role.displayName}
                  </td>
                  <td className="px-3 py-2 align-top text-[10px] text-zinc-700">
                    {role.permissionsCount} permissions
                  </td>
                  <td className="px-3 py-2 align-top text-[10px] text-zinc-700">
                    {role.usersCount} users
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100"
                        aria-label="View details"
                        onClick={(event) => {
                          event.stopPropagation();
                          onViewRole(role);
                        }}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                        aria-label="Edit role"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditRole(role);
                        }}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100"
                        aria-label="Delete role"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteRole(role);
                        }}
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
