"use client";

import { ChartBarIcon, ArrowTrendingUpIcon, UsersIcon, RectangleStackIcon } from "@heroicons/react/24/outline";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-600">Total Programs</p>
              <p className="mt-2 text-3xl font-bold text-zinc-900">24</p>
              <p className="mt-1 text-xs text-green-600">↑ 12% from last month</p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <RectangleStackIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-600">Total Users</p>
              <p className="mt-2 text-3xl font-bold text-zinc-900">2,847</p>
              <p className="mt-1 text-xs text-green-600">↑ 8% from last month</p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <UsersIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-600">Revenue</p>
              <p className="mt-2 text-3xl font-bold text-zinc-900">$48.2K</p>
              <p className="mt-1 text-xs text-green-600">↑ 23% from last month</p>
            </div>
            <div className="rounded-full bg-purple-100 p-3">
              <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-600">Active Programs</p>
              <p className="mt-2 text-3xl font-bold text-zinc-900">18</p>
              <p className="mt-1 text-xs text-zinc-600">6 ending soon</p>
            </div>
            <div className="rounded-full bg-orange-100 p-3">
              <ChartBarIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Placeholder */}
      <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center">
        <ChartBarIcon className="mx-auto h-16 w-16 text-zinc-300" />
        <h3 className="mt-4 text-lg font-semibold text-zinc-900">Advanced Analytics</h3>
        <p className="mt-2 text-sm text-zinc-600">
          Detailed charts, graphs, and analytics dashboard will be implemented here
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Features: Revenue trends, user growth, program performance, conversion rates
        </p>
      </div>
    </div>
  );
}
