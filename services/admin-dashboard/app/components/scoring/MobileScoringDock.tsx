// services/admin-dashboard/app/components/scoring/MobileScoringDock.tsx
"use client";

import { useState } from "react";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { ScoringPanel } from "@/app/components/scoring/ScoringPanel";
import { useApplicationReviewTotal } from "@/app/hooks/useApplicationReviewTotal";
import type { Stage } from "@/app/components/scoring/stage";
import type { ApplicationReviewResponseDto } from "@/src/shared/api-client";

interface MobileScoringDockProps {
  applicationId: string;
  stage: Stage;
  onStageChange: (stage: Stage) => void;
  /** Forwarded to ScoringPanel/AssessmentForm -- so a submit from the mobile
   *  sheet also advances the review queue and is tracked for the unsaved-
   *  changes warning, same as the desktop dock. */
  onSubmitSuccess?: (review: ApplicationReviewResponseDto) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * Below the large breakpoint the scoring panel collapses into this floating
 * button + bottom sheet. The button shows the last-saved running total so
 * it's useful even while collapsed; opening the sheet exposes the same
 * ScoringPanel used by the desktop dock.
 */
export function MobileScoringDock({
  applicationId,
  stage,
  onStageChange,
  onSubmitSuccess,
  onDirtyChange,
}: MobileScoringDockProps) {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const total = useApplicationReviewTotal(applicationId, stage, refreshKey);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Pick up whatever was just saved inside the sheet.
      setRefreshKey((k) => k + 1);
    }
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        title="Open scoring panel"
        onClick={() => handleOpenChange(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
      >
        <ClipboardDocumentCheckIcon className="h-4 w-4" />
        Score: {total ?? "—"}
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="flex max-h-[85vh] flex-col overflow-hidden p-0">
          <SheetHeader className="shrink-0 border-b border-zinc-200 px-6 py-4">
            <SheetTitle>Scoring</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 px-6 py-4">
            <ScoringPanel
              applicationId={applicationId}
              stage={stage}
              onStageChange={onStageChange}
              onSubmitSuccess={onSubmitSuccess}
              onDirtyChange={onDirtyChange}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
