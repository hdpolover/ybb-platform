"use client";

import Link from "next/link";
import {
  FolderIcon,
  RectangleStackIcon,
  UserGroupIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

type StatCard = {
  id: string;
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
};

const stats: StatCard[] = [
  {
    id: "categories",
    title: "Program Categories",
    value: 6,
    description: "Active brands/categories",
    icon: FolderIcon,
    href: "/platform/categories",
    color: "blue",
  },
  {
    id: "programs",
    title: "Programs",
    value: 12,
    description: "Total programs across all categories",
    icon: RectangleStackIcon,
    href: "/platform/programs",
    color: "emerald",
  },
  {
    id: "users",
    title: "Total Users",
    value: "2.4K",
    description: "Participants and ambassadors",
    icon: UserGroupIcon,
    href: "/platform/users",
    color: "purple",
  },
  {
    id: "admins",
    title: "Administrators",
    value: 18,
    description: "Platform and program admins",
    icon: UserGroupIcon,
    href: "/platform/admins",
    color: "amber",
  },
];

const quickActions = [
  {
    id: "new-category",
    title: "Create Program Category",
    description: "Add a new brand or program category",
    href: "/platform/categories/new",
  },
  {
    id: "new-program",
    title: "Create Program",
    description: "Add a new program edition",
    href: "/platform/programs/new",
  },
  {
    id: "view-analytics",
    title: "View Analytics",
    description: "Cross-program reports and insights",
    href: "/platform/analytics",
  },
];

export default function PlatformDashboard() {
  return (
    <div className="space-y-6">
      {/* Bagian header halaman dashboard platform */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Platform Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Overview of all categories, programs, and platform-wide metrics
        </p>
      </div>

      {/* Grid statistik utama */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.id}
              href={stat.href}
              className="group rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-600">{stat.title}</p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{stat.description}</p>
                </div>
                <div className={`rounded-lg bg-${stat.color}-50 p-3`}>
                  <Icon className={`h-6 w-6 text-${stat.color}-600`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Aksi cepat yang sering dipake admin */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Quick Actions</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <h3 className="font-semibold text-zinc-900">{action.title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Placeholder buat activity log terbaru */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Recent Activity</h2>
        <div className="mt-4 text-center text-zinc-500">
          <ChartBarIcon className="mx-auto h-12 w-12 text-zinc-300" />
          <p className="mt-2 text-sm">Activity tracking coming soon</p>
        </div>
      </div>
    </div>
  );
}
