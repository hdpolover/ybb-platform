"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/src/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/src/ui/tooltip";
import { Separator } from "@/src/ui/separator";
import type { NavSection, NavItem } from "@/lib/nav-config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  sections: NavSection[];
  /** For program nav: prefix all relative hrefs with this base, e.g. "/programs/abc123" */
  hrefBase?: string;
  collapsed: boolean;
  context?: "platform" | "program";
  footer?: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveHref(href: string, base?: string): string {
  if (!base) return href; // platform items already have absolute hrefs
  // Program items: empty string = base itself (dashboard)
  return href === "" ? base : `${base}/${href}`;
}

function resolvedMatches(resolved: string, base: string | undefined, pathname: string): boolean {
  if (resolved === "/platform") return pathname === resolved;
  if (base && resolved === base) return pathname === resolved || pathname === `${resolved}/`;
  return pathname === resolved || pathname.startsWith(resolved + "/");
}

/**
 * The longest matching nav href wins, so a parent index route (e.g. ".../analytics")
 * stops being "active" on a deeper sibling page (".../analytics/nationality").
 */
function findActiveHref(
  sections: NavSection[],
  base: string | undefined,
  pathname: string,
): string | null {
  const hrefs: string[] = [];
  const walk = (items: NavItem[]) => {
    for (const item of items) {
      hrefs.push(resolveHref(item.href, base));
      if (item.children?.length) walk(item.children);
    }
  };
  sections.forEach((s) => walk(s.items));

  let best: string | null = null;
  for (const resolved of hrefs) {
    if (resolvedMatches(resolved, base, pathname) && (best === null || resolved.length > best.length)) {
      best = resolved;
    }
  }
  return best;
}

// ─── NavItemRow ───────────────────────────────────────────────────────────────

interface NavItemRowProps {
  item: NavItem;
  hrefBase?: string;
  collapsed: boolean;
  depth?: number;
  activeHref: string | null;
}

function NavItemRow({ item, hrefBase, collapsed, depth = 0, activeHref }: NavItemRowProps) {
  const hasChildren = (item.children?.length ?? 0) > 0;
  const resolved = resolveHref(item.href, hrefBase);

  // The active leaf is the single longest-matching href. A parent is "active"
  // when that active leaf lives somewhere in its subtree.
  const sectionActive =
    activeHref != null && (activeHref === resolved || activeHref.startsWith(resolved + "/"));
  const active = hasChildren ? sectionActive : activeHref === resolved;

  const [open, setOpen] = React.useState(sectionActive);

  // Keep open state in sync when navigation happens
  React.useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  const Icon = item.icon;

  const rowBase = cn(
    "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
    depth > 0 && "py-1.5 text-[13px]",
    active
      ? "bg-blue-500 text-white"
      : "text-blue-100 hover:bg-blue-500/50 hover:text-white",
  );

  const iconEl = <Icon className={cn("h-4 w-4 shrink-0", depth > 0 && "h-3.5 w-3.5")} />;

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className={cn(rowBase, "justify-between")}
        >
          <span className="flex items-center gap-2.5">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>{iconEl}</span>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              iconEl
            )}
            {!collapsed && <span className="truncate">{item.label}</span>}
          </span>
          {!collapsed && (
            <span className="shrink-0 text-blue-200">
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
          )}
        </button>

        {open && !collapsed && (
          <div className="mt-0.5 space-y-0.5 border-l border-blue-500/40 pl-3 ml-3">
            {item.children!.map((child) => (
              <NavItemRow key={child.id} item={child} hrefBase={hrefBase} collapsed={false} depth={depth + 1} activeHref={activeHref} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const linkEl = (
    <Link href={resolved} className={rowBase}>
      {iconEl}
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badgeCount ? (
        <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          {item.badgeCount > 99 ? "99+" : item.badgeCount}
        </span>
      ) : null}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return linkEl;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function AdminSidebar({ sections, hrefBase, collapsed, context = "program", footer }: SidebarProps) {
  const pathname = usePathname();
  const activeHref = findActiveHref(sections, hrefBase, pathname);
  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-blue-800 text-white transition-all duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-blue-700/60 px-3 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          <Image
            src="/img/logosYBB.webp"
            alt="YBB"
            width={34}
            height={34}
            className="object-contain"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">YBB Platform</p>
            <p className="truncate text-[11px] text-blue-200 leading-tight">
              {context === "platform" ? "Platform Admin" : "Admin Dashboard"}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-4 px-2">
          {sections.map((section, i) => (
            <div key={section.id} className="space-y-0.5">
              {section.title && !collapsed && (
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-blue-300/70">
                  {section.title}
                </p>
              )}
              {section.title && collapsed && i > 0 && (
                <Separator className="mb-2 bg-blue-700/40" />
              )}
              {section.items.map((item) => (
                <NavItemRow key={item.id} item={item} hrefBase={hrefBase} collapsed={collapsed} activeHref={activeHref} />
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer slot */}
      {footer && (
        <div className="border-t border-blue-700/60 px-3 py-3">
          {collapsed ? null : footer}
        </div>
      )}
    </aside>
  );
}
