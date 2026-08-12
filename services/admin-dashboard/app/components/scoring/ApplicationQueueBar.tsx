// services/admin-dashboard/app/components/scoring/ApplicationQueueBar.tsx
"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
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
  /** Where "Back to list" returns the reviewer to -- the table route with
   *  the reviewer's filters/sort/page carried over, so the round trip is
   *  lossless. See fullyFundedFilterParsers.ts for the shared URL shape. */
  backHref: string;
  /** Compact hint that the queue mirrors the table's active filters, e.g.
   *  "Not Scored" or "All applicants" when nothing is filtered. */
  filterSummary: string;
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
  backHref,
  filterSummary,
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
        {/* Only affordance back to the table besides the sidebar (which
            drops filters) or the browser back button. Carries the
            reviewer's filters/sort/page via backHref (see the detail
            page) so the round trip lands on the same view. Collapses to
            icon-only before the name would ever have to give up space for
            it -- see the responsive notes below. */}
        <Button asChild variant="outline" size="sm" aria-label="Back to list">
          <Link href={backHref}>
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="hidden xl:inline">Back to list</span>
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Previous applicant"
          disabled={!hasPrev || navigating}
          onClick={onPrev}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="hidden lg:inline">Previous</span>
        </Button>

        <div className="min-w-0 flex-1 text-center">
          {/* Primary orientation cues: which applicant, and where in the
              queue. The name is the one thing that must never disappear,
              so it's the last thing to give up space -- it truncates with
              an ellipsis (title carries the full name for a11y/hover),
              while the badges next to it drop out below `lg` instead of
              squeezing it toward zero width. min-w-0 on every level of
              this flex chain is what lets the truncate actually bite;
              without it a flex child refuses to shrink below its content
              width and the name gets pushed off instead. */}
          <div className="flex min-w-0 items-center justify-center gap-2">
            <span
              className="min-w-0 truncate text-base font-semibold text-zinc-900 sm:text-lg"
              title={applicantName}
            >
              {applicantName}
            </span>
            {category && (
              <Badge
                variant="success"
                className="hidden shrink-0 uppercase tracking-wide lg:inline-flex"
              >
                {category}
              </Badge>
            )}
            <span className="hidden shrink-0 lg:inline-flex">
              <ScoreStatusBadge status={scoreStatus} />
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center justify-center gap-1.5">
            <span className="truncate text-sm font-medium text-zinc-500">{positionLabel}</span>
            {/* Filter-context hint (fix for the queue's relationship to the
                table's filters being buried in the help dialog). Lower
                priority than the badges above -- gone below `lg`, and even
                between `lg` and `xl` it can be trimmed by its own
                max-width before the name would ever be touched. */}
            <span
              className="hidden max-w-[9rem] shrink-0 truncate rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 lg:inline-block"
              title={filterSummary}
            >
              {filterSummary}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Next applicant"
          disabled={!hasNext || navigating}
          onClick={onNext}
        >
          <span className="hidden lg:inline">Next</span>
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
