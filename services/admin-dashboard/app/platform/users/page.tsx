"use client";

import { UserGroupIcon, PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Platform Users</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Manage all users across the platform
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Search and Filters */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">All Roles</option>
            <option value="participant">Participant</option>
            <option value="reviewer">Reviewer</option>
            <option value="coordinator">Coordinator</option>
          </select>
        </div>
      </div>

      {/* Content Placeholder */}
      <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
        <UserGroupIcon className="mx-auto h-16 w-16 text-zinc-300" />
        <h3 className="mt-4 text-lg font-semibold text-zinc-900">User Management</h3>
        <p className="mt-2 text-sm text-zinc-600">
          User list and management interface will be implemented here
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Features: User listing, role assignment, permissions, account status
        </p>
      </div>
    </div>
  );
}
