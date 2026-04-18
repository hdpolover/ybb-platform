"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Layers, BarChart2, Users } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";
import { listPlatformBrands, listPlatformPrograms } from "./api";

const quickActions = [
  {
    id: "new-category",
    title: "Create Brand",
    description: "Add a new brand",
    href: "/platform/brands",
  },
  {
    id: "new-program",
    title: "Create Program",
    description: "Create a top-level program shell",
    href: "/platform/programs",
  },
  {
    id: "view-analytics",
    title: "View Analytics",
    description: "Cross-program reports and insights",
    href: "/platform/analytics",
  },
];

export default function PlatformDashboard() {
  const [categoryCount, setCategoryCount] = useState(0);
  const [programCount, setProgramCount] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [activeCategoryCount, setActiveCategoryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      setIsLoading(true);
      setPageError(null);

      try {
        const [brands, programs] = await Promise.all([
          listPlatformBrands(),
          listPlatformPrograms({ page: 1, limit: 100 }),
        ]);

        if (!isMounted) {
          return;
        }

        setCategoryCount(brands.length);
        setActiveCategoryCount(brands.filter((brand) => brand.isActive).length);
        setProgramCount(programs.total);
        setPublishedCount(programs.data.filter((program) => program.isPublished).length);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageError(error instanceof Error ? error.message : "Failed to load platform overview.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats: DashboardStat[] = useMemo(
    () => [
      {
        id: "categories",
        title: "Brands",
        value: categoryCount,
        description: `${activeCategoryCount} active brands`,
        icon: FolderOpen,
        href: "/platform/brands",
        iconClassName: "text-blue-600",
        backgroundClassName: "bg-blue-50",
      },
      {
        id: "programs",
        title: "Programs",
        value: programCount,
        description: "Total programs across all brands",
        icon: Layers,
        href: "/platform/programs",
        iconClassName: "text-emerald-600",
        backgroundClassName: "bg-emerald-50",
      },
      {
        id: "published-programs",
        title: "Published Programs",
        value: publishedCount,
        description: "Visible or launch-ready programs",
        icon: BarChart2,
        href: "/platform/programs",
        iconClassName: "text-amber-600",
        backgroundClassName: "bg-amber-50",
      },
      {
        id: "admins",
        title: "Administrators",
        value: "Manage",
        description: "Platform and program admin access",
        icon: Users,
        href: "/platform/admins",
        iconClassName: "text-zinc-700",
        backgroundClassName: "bg-zinc-100",
      },
    ],
    [activeCategoryCount, categoryCount, programCount, publishedCount],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        description="Overview of all brands, programs, and platform-wide metrics"
      />

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
                  <p className="mt-2 text-3xl font-bold text-zinc-900">
                    {isLoading && typeof stat.value === "number" ? "..." : stat.value}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{stat.description}</p>
                </div>
                <div className={`rounded-lg p-3 ${stat.backgroundClassName}`}>
                  <Icon className={`h-6 w-6 ${stat.iconClassName}`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {pageError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      ) : null}

      {/* Quick actions */}
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

      {/* Recent Activity placeholder */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Recent Activity</h2>
        <div className="mt-4 text-center text-zinc-500">
          <BarChart2 className="mx-auto h-12 w-12 text-zinc-300" />
          <p className="mt-2 text-sm">Activity tracking coming soon</p>
        </div>
      </div>
    </div>
  );
}
