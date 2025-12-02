"use client";

import { ChartBarIcon, ArrowTrendingUpIcon, UsersIcon, RectangleStackIcon, ArrowDownTrayIcon, FunnelIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Platform Analytics</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Comprehensive analytics and insights across all programs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Total Programs</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">24</p>
              <p className="mt-1 text-[10px] text-emerald-600">↑ 12% from last month</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2.5">
              <RectangleStackIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Total Users</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">2,847</p>
              <p className="mt-1 text-[10px] text-emerald-600">↑ 8% from last month</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2.5">
              <UsersIcon className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Revenue</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">$48.2K</p>
              <p className="mt-1 text-[10px] text-emerald-600">↑ 23% from last month</p>
            </div>
            <div className="rounded-full bg-purple-100 p-2.5">
              <ArrowTrendingUpIcon className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Active Programs</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">18</p>
              <p className="mt-1 text-[10px] text-zinc-600">6 ending soon</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2.5">
              <ChartBarIcon className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <section className="rounded-md border border-zinc-200 bg-white px-5 py-4 text-sm shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Performance Analytics</h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              Detailed insights and trends across all programs
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5 text-emerald-500" />
              Export Report
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

        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Time Period
            </label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
              <option>Last year</option>
              <option>All time</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Program
            </label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>All Programs</option>
              <option>IYS 2024</option>
              <option>JYS 2025</option>
              <option>KYS 2025</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-700">
              Metric
            </label>
            <select className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>All Metrics</option>
              <option>User Growth</option>
              <option>Revenue</option>
              <option>Conversion Rate</option>
              <option>Engagement</option>
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-12 text-center">
          <ChartBarIcon className="mx-auto h-16 w-16 text-zinc-300" />
          <h3 className="mt-4 text-sm font-semibold text-zinc-900">Analytics Visualization</h3>
          <p className="mt-2 text-xs text-zinc-600">
            Detailed charts and graphs will be displayed here
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Revenue trends, user growth, program performance, conversion rates
          </p>
        </div>
      </section>
    </div>
  );
}
