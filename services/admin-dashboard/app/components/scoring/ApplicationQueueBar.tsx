// services/admin-dashboard/app/components/scoring/ApplicationQueueBar.tsx
"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  QuestionMarkCircleIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/src/ui/button";
import { Badge } from "@/src/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/ui/dropdown-menu";
import { ScoreStatusBadge } from "./ScoreStatusBadge";

interface ApplicationQueueBarProps {
  applicantName: string;
  /** Application category label (e.g. "Fully Funded"). Optional -- omitted
   *  entirely when the caller has no category to show. */
  category?: string | null;
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
  /** Same handlers FullyFundedHeaderCard used to take -- carried over into
   *  the "Applicant actions" overflow menu below so the per-participant
   *  Edit Profile / Export Data actions have a home now that the tall
   *  profile card no longer renders on this screen. Both optional so the
   *  menu degrades gracefully if a caller has nothing to wire. */
  onEditProfile?: () => void;
  onExportData?: () => void;
  exporting?: boolean;
}

/**
 * Sits above the split-view columns. Previous/Next step through the same
 * filtered list the reviewer was looking at in the table (see
 * useApplicationQueue), so a reviewer can work an entire filtered set --
 * e.g. Score Status = "Not Scored" -- without ever going back to the list.
 */
export function ApplicationQueueBar({
  applicantName,
  category,
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
  onEditProfile,
  onExportData,
  exporting,
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
          {/* Primary orientation cues: which applicant, and where in the
              queue. Name truncates rather than wrapping/pushing Previous or
              Next out of the row; badges keep their natural width. */}
          <div className="flex min-w-0 items-center justify-center gap-2">
            <span
              className="min-w-0 truncate text-base font-semibold text-zinc-900 sm:text-lg"
              title={applicantName}
            >
              {applicantName}
            </span>
            {category && (
              <Badge variant="success" className="shrink-0 uppercase tracking-wide">
                {category}
              </Badge>
            )}
            <span className="shrink-0">
              <ScoreStatusBadge status={scoreStatus} />
            </span>
          </div>
          <span className="mt-0.5 block text-sm font-medium text-zinc-500">{positionLabel}</span>
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

        {/* Compact overflow menu -- replaces the tall profile card's Edit
            Profile / Export Data buttons, which no longer have a home on
            this screen now that the card isn't rendered here. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Applicant actions">
              <EllipsisVerticalIcon className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Only render Edit Profile when a caller actually wires it. The old
                header card rendered this button unconditionally with an undefined
                onClick, so it silently did nothing. A menu item that looks
                actionable and is not is worse than no item at all. */}
            {onEditProfile ? (
              <DropdownMenuItem onSelect={() => onEditProfile()}>
                <PencilIcon className="h-4 w-4" />
                Edit Profile
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={exporting} onSelect={() => onExportData?.()}>
              <ArrowDownTrayIcon className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export Data"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
