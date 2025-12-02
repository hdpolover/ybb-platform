"use client";

import { ShieldCheckIcon, PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function AdminsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Administrators</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Manage platform administrators and their access levels
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
          Add Administrator
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
                placeholder="Search administrators..."
                className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">All Access Levels</option>
            <option value="super">Super Admin</option>
            <option value="program">Program Admin</option>
            <option value="platform">Platform Admin</option>
          </select>
          <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Content Placeholder */}
      <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
        <ShieldCheckIcon className="mx-auto h-16 w-16 text-zinc-300" />
        <h3 className="mt-4 text-lg font-semibold text-zinc-900">Administrator Management</h3>
        <p className="mt-2 text-sm text-zinc-600">
          Administrator list and permissions interface will be implemented here
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Features: Admin listing, role management, permissions, activity logs
        </p>
      </div>
    </div>
  );
}
