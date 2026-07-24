"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Search, UserCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { EmptyState } from "@/src/admin/empty-state";
import { listApplications, type Application } from "@/src/shared/api-client";

const SEARCH_DEBOUNCE_MS = 300;
const RESULTS_LIMIT = 20;

// The LOA preview participant pool is deliberately "submitted or accepted"
// only (see 2026-07-24 design doc). The backend's explicit-applicationId
// preview branch validates the application belongs to the program but does
// NOT re-validate status, so this picker is the sole enforcement point for
// the pool rule - it must never surface a draft, rejected, or withdrawn
// application. GET /applications takes a single status value (no "in"
// filter), so we issue one request per eligible status and merge client-side
// rather than over-fetching everything and filtering in the browser.
const ELIGIBLE_STATUSES = ["submitted", "accepted"] as const;

interface LoaParticipantPickerProps {
  programId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (applicationId: string, participantName: string) => void;
}

/**
 * Search picker for "Previewing as: <name> [change]". Lets an admin pick a
 * specific application to preview the Invitation Letter as. Reuses the
 * existing admin applications search endpoint (GET /applications) - no new
 * search endpoint was introduced for this feature.
 */
export function LoaParticipantPicker({ programId, open, onOpenChange, onSelect }: LoaParticipantPickerProps): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Application[]>([]);
  // Sum of each status request's `total` (server-side match count for that
  // status, ignoring our client-side RESULTS_LIMIT/dedup). Used only to tell
  // whether the list below is truncated - see the notice rendered below the
  // list. Not an exact unique-match count (see comment at its usage site).
  const [totalMatching, setTotalMatching] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResults([]);
    setTotalMatching(0);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Guard against a stale request overwriting state if the admin keeps
    // typing while an earlier search is still in flight.
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      const trimmedSearch = search.trim() || undefined;
      Promise.all(
        ELIGIBLE_STATUSES.map((status) =>
          listApplications({ programId, search: trimmedSearch, status, limit: RESULTS_LIMIT }),
        ),
      )
        .then((responses) => {
          if (cancelled) return;
          const merged = responses.flatMap((r) => r.data);
          const deduped = Array.from(new Map(merged.map((app) => [app.id, app])).values());
          deduped.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          setResults(deduped.slice(0, RESULTS_LIMIT));
          // An application has exactly one status, so the two ELIGIBLE_STATUSES
          // requests can't double-count the same application - summing their
          // `total` fields is a true count of matches across both statuses,
          // even though `results` itself is capped at RESULTS_LIMIT.
          setTotalMatching(responses.reduce((sum, r) => sum + r.total, 0));
        })
        .catch(() => {
          if (!cancelled) {
            setError("Failed to search applications");
            setTotalMatching(0);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, programId, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Preview as participant</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              aria-label="Search participants by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="block w-full rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-zinc-100">
            {loading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              </div>
            ) : error ? (
              <p className="px-3 py-6 text-center text-xs text-red-600">{error}</p>
            ) : results.length === 0 ? (
              <EmptyState
                className="py-8"
                icon={UserCircle2}
                title="No applications found"
                description="Only submitted or accepted applications can be previewed."
              />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {results.map((app) => (
                  <li key={app.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(app.id, app.participant?.fullName ?? "Unknown participant");
                        onOpenChange(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 active:bg-blue-100"
                    >
                      <UserCircle2 className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-zinc-800">
                          {app.participant?.fullName ?? "Unknown participant"}
                        </span>
                        <span className="block truncate text-[10px] text-zinc-400">
                          {app.participant?.email ?? app.id} · {app.status}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!loading && !error && totalMatching > results.length ? (
            // This picker exists so an admin can reproduce a complaint about a
            // specific named person - silently dropping matches past
            // RESULTS_LIMIT would defeat that, so a common name in a large
            // program must say so instead of just looking complete.
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[10px] text-amber-700">
              Showing {results.length} of {totalMatching} matches. Refine your search to find a specific participant.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
