"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Squares2X2Icon,
  FolderIcon,
  RectangleStackIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
} from "@heroicons/react/24/solid";

type MenuItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/platform",
    icon: Squares2X2Icon,
  },
  {
    id: "categories",
    label: "Program Categories",
    href: "/platform/categories",
    icon: FolderIcon,
  },
  {
    id: "programs",
    label: "Programs",
    href: "/platform/programs",
    icon: RectangleStackIcon,
  },
  {
    id: "users",
    label: "Users",
    href: "/platform/users",
    icon: UserGroupIcon,
  },
  {
    id: "admins",
    label: "Admins",
    href: "/platform/admins",
    icon: UserGroupIcon,
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/platform/analytics",
    icon: ChartBarIcon,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/platform/settings",
    icon: Cog6ToothIcon,
  },
];

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900">
      {/* Sidebar */}
      <aside
        className={`flex h-screen flex-col bg-blue-800 text-white transition-all duration-200 ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 border-b border-blue-500 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded">
            <Image
              src="/img/logosYBB.webp"
              alt="YBB Platform logo"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold">YBB Platform</span>
              <span className="text-[13px] text-blue-100">Platform Admin</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-blue-100 hover:bg-blue-500/60 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 flex-none" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-blue-500 px-4 py-3 text-xs text-blue-100">
          {!sidebarCollapsed && (
            <>
              <div>Platform Management</div>
              <div className="text-sm font-medium text-white">Super Admin</div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex h-screen flex-1 flex-col">
        {/* Navbar */}
        <header className="flex h-16 items-center border-b bg-white px-6 shadow-sm">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
            aria-label="Toggle sidebar"
          >
            <span className="flex h-3 w-4 flex-col justify-between">
              <span className="h-[2px] w-full rounded bg-zinc-700" />
              <span className="h-[2px] w-full rounded bg-zinc-700" />
              <span className="h-[2px] w-full rounded bg-zinc-700" />
            </span>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Back to Programs
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-white px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
