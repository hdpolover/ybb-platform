// services/admin-dashboard/app/components/scoring/ApplicationQueueBar.tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "@/src/ui/button";
import { ScoreStatusBadge } from "./ScoreStatusBadge";

interface ApplicationQueueBarProps {
  applicantName: string;
  /** From the applicant already loaded on the page -- not the queue's own fetch,
   *  so it's accurate even when the queue can't place this applicant on a page. */
  scoreStatus: string | null;
  /** 1-based position in the filtered queue, or null when unknown (see useApplicationQueue). */
  position: number | null;
  total: number;
  loading: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  navigating: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenHelp: () => void;
}

/**
 * Sits above the split-view columns. Previous/Next step through the same
 * filtered list the reviewer was looking at in the table (see
 * useApplicationQueue), so a reviewer can work an entire filtered set --
 * e.g. Score Status = "Not Scored" -- without ever going back to the list.
 */
export function ApplicationQueueBar({
  applicantName,
  scoreStatus,
  position,
  total,
  loading,
  hasPrev,
  hasNext,
  navigating,
  onPrev,
  onNext,
  onOpenHelp,
}: ApplicationQueueBarProps) {
  const progressPercent = position != null && total > 0 ? Math.round((position / total) * 100) : 0;
  const positionLabel = loading ? "Loading queue..." : position != null ? `${position} of ${total}` : total > 0 ? `Not in current page (${total} total)` : "";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Previous applicant"
          disabled={!hasPrev || navigating}
          onClick={onPrev}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Previous
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="truncate text-sm font-semibold text-zinc-900">{applicantName}</span>
            <ScoreStatusBadge status={scoreStatus} />
          </div>
          <span className="text-xs text-zinc-500">{positionLabel}</span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Next applicant"
          disabled={!hasNext || navigating}
          onClick={onNext}
        >
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          onClick={onOpenHelp}
        >
          <QuestionMarkCircleIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
