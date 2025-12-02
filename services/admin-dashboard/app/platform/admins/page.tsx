"use client";

import { PlusIcon, MagnifyingGlassIcon, FunnelIcon, ArrowPathIcon, ArrowDownTrayIcon, ShieldCheckIcon, UserGroupIcon } from "@heroicons/react/24/outline";

export default function AdminsPage() {
  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Platform Administrators</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage platform administrators and their access permissions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Total Admins</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">18</p>
              <p className="mt-1 text-[10px] text-zinc-600">Across all levels</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2.5">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Super Admins</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">3</p>
              <p className="mt-1 text-[10px] text-zinc-600">Full access</p>
            </div>
            <div className="rounded-full bg-purple-100 p-2.5">
              <ShieldCheckIcon className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Program Admins</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">15</p>
              <p className="mt-1 text-[10px] text-zinc-600">Multi & single</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2.5">
              <UserGroupIcon className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Active Now</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">7</p>
              <p className="mt-1 text-[10px] text-emerald-600">Online</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2.5">
              <UserGroupIcon className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>
      <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Platform Administrators</h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              Manage administrators and their access permissions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add Administrator
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5 text-emerald-500" />
              Export Data
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
            >
              <FunnelIcon className="h-3.5 w-3.5" />
              Apply Filters
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-zinc-700">
            Search
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name, email, or admin ID..."
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              <MagnifyingGlassIcon className="h-3.5 w-3.5" />
              Search
            </button>
          </div>
        </div>

        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Access Level
            </label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>All Access Levels</option>
              <option>Super Admin (Level 3)</option>
              <option>Multi-Program Admin (Level 2)</option>
              <option>Single Program Admin (Level 1)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Account Status
            </label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>All Statuses</option>
              <option>Active</option>
              <option>Inactive</option>
              <option>Suspended</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Program Assignment
            </label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>All Programs</option>
              <option>IYS 2024</option>
              <option>JYS 2025</option>
              <option>KYS 2025</option>
              <option>No Program (Platform Admin)</option>
            </select>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-md border border-zinc-200">
          <table className="min-w-full border-collapse text-left text-[11px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Admin ID</th>
                <th className="px-3 py-2 font-semibold">Admin Info</th>
                <th className="px-3 py-2 font-semibold">Access Level</th>
                <th className="px-3 py-2 font-semibold">Program(s)</th>
                <th className="px-3 py-2 font-semibold">Last Active</th>
                <th className="px-3 py-2 text-right font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="align-top px-3 py-2 text-zinc-800">
                  <div className="font-medium">#ADM-001</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="font-semibold text-zinc-900">John Smith</div>
                  <div className="text-zinc-600">john.smith@ybb.org</div>
                  <div className="text-[10px] text-zinc-500">Super Administrator</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="font-medium">Level 3</div>
                  <div className="text-[10px] text-zinc-500">Full Access</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="text-[10px]">All Programs</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="text-[10px]">2 hours ago</div>
                </td>
                <td className="align-top px-3 py-2 text-right">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Active
                  </span>
                </td>
                <td className="align-top px-3 py-2 text-right">
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                  >
                    View details
                  </button>
                </td>
              </tr>

              <tr className="bg-zinc-50/60">
                <td className="align-top px-3 py-2 text-zinc-800">
                  <div className="font-medium">#ADM-015</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="font-semibold text-zinc-900">Emily Chen</div>
                  <div className="text-zinc-600">emily.chen@ybb.org</div>
                  <div className="text-[10px] text-zinc-500">Program Administrator</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="font-medium">Level 2</div>
                  <div className="text-[10px] text-zinc-500">Multi-Program</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="text-[10px]">IYS 2024, JYS 2025</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="text-[10px]">1 day ago</div>
                </td>
                <td className="align-top px-3 py-2 text-right">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Active
                  </span>
                </td>
                <td className="align-top px-3 py-2 text-right">
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                  >
                    View details
                  </button>
                </td>
              </tr>

              <tr className="bg-white">
                <td className="align-top px-3 py-2 text-zinc-800">
                  <div className="font-medium">#ADM-023</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="font-semibold text-zinc-900">Ahmed Rahman</div>
                  <div className="text-zinc-600">ahmed.rahman@ybb.org</div>
                  <div className="text-[10px] text-zinc-500">Program Administrator</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="font-medium">Level 1</div>
                  <div className="text-[10px] text-zinc-500">Single Program</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="text-[10px]">KYS 2025</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="text-[10px]">3 days ago</div>
                </td>
                <td className="align-top px-3 py-2 text-right">
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Pending Setup
                  </span>
                </td>
                <td className="align-top px-3 py-2 text-right">
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                  >
                    View details
                  </button>
                </td>
              </tr>

              <tr className="bg-zinc-50/60">
                <td className="align-top px-3 py-2 text-zinc-800">
                  <div className="font-medium">#ADM-019</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="font-semibold text-zinc-900">Maria Lopez</div>
                  <div className="text-zinc-600">maria.lopez@ybb.org</div>
                  <div className="text-[10px] text-zinc-500">Program Administrator</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="font-medium">Level 1</div>
                  <div className="text-[10px] text-zinc-500">Single Program</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="text-[10px]">IYS 2024</div>
                </td>
                <td className="align-top px-3 py-2 text-zinc-700">
                  <div className="text-[10px]">2 weeks ago</div>
                </td>
                <td className="align-top px-3 py-2 text-right">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                    Inactive
                  </span>
                </td>
                <td className="align-top px-3 py-2 text-right">
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                  >
                    View details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
