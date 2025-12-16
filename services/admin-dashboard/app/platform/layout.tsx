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
import {
  MagnifyingGlassIcon,
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon as Cog6ToothIconOutline,
} from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/AuthContext";

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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { adminProfile, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900">
      {/* Sidebar utama buat navigasi platform */}
      <aside
        className={`flex h-screen flex-col bg-blue-800 text-white transition-all duration-200 ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Logo YBB di sidebar */}
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

        {/* Menu navigasi ke halaman-halaman platform */}
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

        {/* Footer kecil di bawah sidebar */}
        <div className="border-t border-blue-500 px-4 py-3 text-xs text-blue-100">
          {!sidebarCollapsed && (
            <>
              <div>Platform Management</div>
              <div className="text-sm font-medium text-white">Super Admin</div>
            </>
          )}
        </div>
      </aside>

      {/* Area konten utama */}
      <div className="flex h-screen flex-1 flex-col">
        {/* Navbar atas buat tombol toggle + info admin */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
            aria-label="Toggle sidebar"
          >
            <span className="flex h-3 w-4 flex-col justify-between">
              <span className="h-[2px] w-full rounded bg-zinc-700" />
              <span className="h-[2px] w-full rounded bg-zinc-700" />
              <span className="h-[2px] w-full rounded bg-zinc-700" />
            </span>
          </button>

          <div className="flex items-center gap-3">
            {/* Tombol balik ke halaman awal / programs */}
            <Link
              href="/"
              className="hidden h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 sm:flex"
            >
              Back to Programs
            </Link>

            {/* Tombol notifikasi di navbar */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              >
                <BellIcon className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
              </button>

              {/* Dropdown list notifikasi */}
              {showNotifications && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg">
                  <div className="border-b border-zinc-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-zinc-900">Notifications</h3>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        3 New
                      </span>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="border-b border-zinc-100 px-4 py-3 hover:bg-zinc-50">
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-blue-100">
                          <RectangleStackIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-zinc-900">New program created</p>
                          <p className="text-[10px] text-zinc-600">Summer Leadership Camp 2025 was added</p>
                          <p className="mt-1 text-[10px] text-zinc-400">5 minutes ago</p>
                        </div>
                      </div>
                    </div>
                    <div className="border-b border-zinc-100 px-4 py-3 hover:bg-zinc-50">
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-100">
                          <UserGroupIcon className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-zinc-900">New user registration</p>
                          <p className="text-[10px] text-zinc-600">15 new participants registered today</p>
                          <p className="mt-1 text-[10px] text-zinc-400">2 hours ago</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 hover:bg-zinc-50">
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-100">
                          <ChartBarIcon className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-zinc-900">Weekly report ready</p>
                          <p className="text-[10px] text-zinc-600">Platform analytics for last week</p>
                          <p className="mt-1 text-[10px] text-zinc-400">1 day ago</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-zinc-200 px-4 py-2">
                    <button
                      type="button"
                      className="w-full rounded-md py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Menu profile admin + dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 hover:bg-zinc-50"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                  {adminProfile?.avatarUrl ? (
                    <Image
                      src={adminProfile.avatarUrl}
                      alt={adminProfile.fullName}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  ) : (
                    <UserCircleIcon className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-xs font-semibold text-zinc-900">
                    {adminProfile?.fullName || "Admin"}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {adminProfile?.roleName || "Super Admin"}
                  </div>
                </div>
              </button>

              {/* Dropdown detail profile & action akun */}
              {showProfileMenu && (
                <div className="absolute right-0 top-12 z-50 w-64 rounded-lg border border-zinc-200 bg-white shadow-lg">
                  <div className="border-b border-zinc-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                        <UserCircleIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          {adminProfile?.fullName || "Admin User"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {adminProfile?.email || "admin@ybb.com"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <Link
                      href="/platform/settings"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <Cog6ToothIconOutline className="h-4 w-4 text-zinc-500" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Isi halaman yang lagi kebuka */}
        <main className="flex-1 overflow-y-auto bg-white px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
