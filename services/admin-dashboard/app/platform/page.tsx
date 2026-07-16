"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FolderOpen,
  Layers,
  Users,
  TrendingUp,
  UserCheck,
  PlayCircle,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";
import { listPlatformBrands, type PlatformBrand } from "./api";
import { getAdminAnalytics, type AdminAnalytics } from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";

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
  {
    id: "support-access",
    title: "Support Access",
    description: "Manage admin impersonation controls",
    href: "/platform/support-access",
  },
];

type StatCard = {
  id: string;
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  href: string;
  iconClassName: string;
  backgroundClassName: string;
};

export default function PlatformDashboard() {
  const { adminProfile } = useAuth();
  const brandId = adminProfile?.assignedBrands?.[0]?.brandId;

  const [brands, setBrands] = useState<PlatformBrand[] | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);

    try {
      const [brandsData, analyticsData] = await Promise.all([
        listPlatformBrands(),
        getAdminAnalytics(brandId),
      ]);
      setBrands(brandsData);
      setAnalytics(analyticsData);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load platform overview.");
    } finally {
      setIsLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const activeBrandCount = brands?.filter((b) => b.isActive).length ?? 0;

  const stats: StatCard[] = [
    {
      id: "brands",
      title: "Brands",
      value: isLoading ? "..." : (brands?.length ?? 0),
      description: isLoading ? "" : `${activeBrandCount} active brands`,
      icon: FolderOpen,
      href: "/platform/brands",
      iconClassName: "text-blue-600",
      backgroundClassName: "bg-blue-50",
    },
    {
      id: "programs",
      title: "Programs",
      value: isLoading ? "..." : (analytics?.programs.total ?? 0),
      description: isLoading ? "" : `${analytics?.programs.published ?? 0} published`,
      icon: Layers,
      href: "/platform/programs",
      iconClassName: "text-emerald-600",
      backgroundClassName: "bg-emerald-50",
    },
    {
      id: "users",
      title: "Users",
      value: isLoading ? "..." : (analytics?.users.total ?? 0),
      description: isLoading ? "" : `${analytics?.users.new_this_month ?? 0} new this month`,
      icon: Users,
      href: "/platform/admins",
      iconClassName: "text-violet-600",
      backgroundClassName: "bg-violet-50",
    },
    {
      id: "applications",
      title: "Applications",
      value: isLoading ? "..." : (analytics?.applications.total ?? 0),
      description: "All time",
      icon: TrendingUp,
      href: "/platform/analytics",
      iconClassName: "text-amber-600",
      backgroundClassName: "bg-amber-50",
    },
    {
      id: "participants",
      title: "Participants",
      value: isLoading ? "..." : (analytics?.participants.total ?? 0),
      description: "Accepted participants",
      icon: UserCheck,
      href: "/platform/analytics",
      iconClassName: "text-teal-600",
      backgroundClassName: "bg-teal-50",
    },
    {
      id: "active-programs",
      title: "Active Programs",
      value: isLoading ? "..." : (analytics?.programs.active ?? 0),
      description: "Currently running",
      icon: PlayCircle,
      href: "/platform/programs",
      iconClassName: "text-green-600",
      backgroundClassName: "bg-green-50",
    },
    {
      id: "active-users",
      title: "Active Users",
      value: isLoading ? "..." : (analytics?.users.active ?? 0),
      description: "Verified accounts",
      icon: Activity,
      href: "/platform/admins",
      iconClassName: "text-indigo-600",
      backgroundClassName: "bg-indigo-50",
    },
    {
      id: "admins",
      title: "Administrators",
      value: "Manage",
      description: "Platform and program admin access",
      icon: ShieldCheck,
      href: "/platform/admins",
      iconClassName: "text-zinc-700",
      backgroundClassName: "bg-zinc-100",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        description="Overview of all brands, programs, and platform-wide metrics"
      />

      {/* Error banner — show at top, always */}
      {pageError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      ) : null}

      {/* Stat grid — only when not errored or data already loaded */}
      {(!pageError || brands !== null || analytics !== null) ? (
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
                  <div className={`rounded-lg p-3 ${stat.backgroundClassName}`}>
                    <Icon className={`h-6 w-6 ${stat.iconClassName}`} />
                  </div>
                </div>
              </Link>
            );
          })}
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

      {/* Top Programs */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Top Programs by Applicants</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-zinc-400">Loading…</p>
        ) : (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Program</TableHead>
                <TableHead className="text-right">Applicants</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(analytics?.top_programs ?? []).map((p, idx) => (
                <TableRow key={p.id}>
                  <TableCell className="text-zinc-500">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right font-semibold">{p.applicants}</TableCell>
                </TableRow>
              ))}
              {!analytics?.top_programs?.length && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-zinc-400">
                    No data yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
