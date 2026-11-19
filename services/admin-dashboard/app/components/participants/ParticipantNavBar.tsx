// services/admin-dashboard/app/components/participants/ParticipantNavBar.tsx
"use client";

import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsString } from "nuqs";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getNeighbours, parseParticipantNav, readParticipantNavRaw } from "@/lib/participant-nav";

const BASE = "inline-flex h-8 items-center justify-center gap-1 rounded border px-2.5 text-xs font-medium";
const ENABLED = `${BASE} border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`;
// Disabled mutes the fill and text; the outline stays.
const DISABLED = `${BASE} cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400`;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

interface Props {
  /** Route param exactly as in the URL; it is the sessionStorage key the list page wrote. */
  programParam: string;
  accountId: string;
}

/** Back to list / prev / next across the list page the admin came from. Renders nothing without saved nav. */
export function ParticipantNavBar({ programParam, accountId }: Props) {
  const router = useRouter();
  const [tab] = useQueryState("tab", parseAsString);
  // sessionStorage doesn't exist during SSR; the server snapshot is null, so the bar appears after hydration.
  const raw = useSyncExternalStore(
    () => () => {},
    () => readParticipantNavRaw(programParam),
    () => null,
  );
  const nav = useMemo(() => parseParticipantNav(raw), [raw]);

  const n = useMemo(() => getNeighbours(nav, accountId), [nav, accountId]);
  const hrefFor = (id: string) =>
    `/programs/${programParam}/participants/${id}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;
  const prevHref = n?.prevId ? hrefFor(n.prevId) : null;
  const nextHref = n?.nextId ? hrefFor(n.nextId) : null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const href = e.key === "[" ? prevHref : e.key === "]" ? nextHref : null;
      if (href) router.push(href);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevHref, nextHref, router]);

  if (!nav || !n) return null;

  return (
    <nav aria-label="Participant navigation" className="flex flex-wrap items-center gap-2">
      <Link href={nav.listHref} className={ENABLED}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to list
      </Link>
      {prevHref ? (
        <Link href={prevHref} aria-label="Previous participant" title="Previous participant ([)" className={ENABLED}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Prev
        </Link>
      ) : (
        <button type="button" disabled aria-label="Previous participant" title="First in this list" className={DISABLED}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Prev
        </button>
      )}
      <span className="text-xs font-medium tabular-nums text-zinc-500" title="Position in the list page you came from">
        {n.index + 1} of {n.total}
      </span>
      {nextHref ? (
        <Link href={nextHref} aria-label="Next participant" title="Next participant (])" className={ENABLED}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : (
        <button type="button" disabled aria-label="Next participant" title="Last in this list" className={DISABLED}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </nav>
  );
}
