"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Home, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/ui/button";
import { AdminSidebar } from "./admin-sidebar";
import type { NavSection } from "@/lib/nav-config";

// ─── Navbar ───────────────────────────────────────────────────────────────────

interface AdminNavbarProps {
  onToggleSidebar: () => void;
  /** Slot for context-specific controls (e.g. program selector) */
  contextControls?: React.ReactNode;
  /** Slot for right-side user menu / account */
  userMenu?: React.ReactNode;
  homeHref?: string;
}

export function AdminNavbar({
  onToggleSidebar,
  contextControls,
  userMenu,
  homeHref = "/",
}: AdminNavbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 shadow-sm sm:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="text-zinc-500"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {contextControls}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-zinc-500" onClick={() => {}}>
          <Link href={homeHref} aria-label="Home" className="flex items-center justify-center">
            <Home className="h-5 w-5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="relative text-zinc-500">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
        </Button>
        {userMenu}
      </div>
    </header>
  );
}

// ─── AdminShell ───────────────────────────────────────────────────────────────

interface AdminShellProps {
  children: React.ReactNode;
  navSections: NavSection[];
  /** For program context: the base path, e.g. "/programs/abc123" */
  hrefBase?: string;
  context?: "platform" | "program";
  /** Slot forwarded to navbar's context area (e.g. ProgramSelect) */
  contextControls?: React.ReactNode;
  /** Slot for user/account menu in navbar */
  userMenu?: React.ReactNode;
  /** Slot for sidebar footer */
  sidebarFooter?: React.ReactNode;
  homeHref?: string;
  className?: string;
}

export function AdminShell({
  children,
  navSections,
  hrefBase,
  context = "program",
  contextControls,
  userMenu,
  sidebarFooter,
  homeHref,
  className,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className={cn("flex h-screen overflow-hidden bg-zinc-50 text-zinc-900", className)}>
      <AdminSidebar
        sections={navSections}
        hrefBase={hrefBase}
        collapsed={collapsed}
        context={context}
        footer={sidebarFooter}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminNavbar
          onToggleSidebar={() => setCollapsed((c) => !c)}
          contextControls={contextControls}
          userMenu={userMenu}
          homeHref={homeHref}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
