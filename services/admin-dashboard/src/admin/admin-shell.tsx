"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Home, Bell, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/ui/button";
import { AdminSidebar } from "./admin-sidebar";
import type { NavSection } from "@/lib/nav-config";
import { toast } from "sonner";
import { clearAllCache } from "@/src/shared/api-client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";

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
  const [open, setOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  async function handleConfirm() {
    setClearing(true);
    try {
      await clearAllCache();
      setOpen(false);
      toast.success("Cache cleared", {
        description: "All cached data has been flushed successfully.",
      });
    } catch (err) {
      toast.error("Failed to clear cache", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear all cache?</DialogTitle>
            <DialogDescription>
              This will immediately flush all cached data on the server. Pages and API responses will
              be slower until the cache is rebuilt. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={clearing}
              className={cn(clearing && "animate-pulse")}
            >
              {clearing ? "Clearing…" : "Clear cache"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(true)}
                  aria-label="Clear cache"
                  className="text-zinc-500"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Clear cache
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
    </>
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
