// services/admin-dashboard/app/components/scoring/ScoringPanel.tsx
"use client";

import { forwardRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/src/ui/tabs";
import {
  AssessmentForm,
  type AssessmentFormHandle,
} from "@/app/components/scoring/AssessmentForm";
import { STAGES, STAGE_LABELS, type Stage } from "@/app/components/scoring/stage";
import type { ApplicationReviewResponseDto } from "@/src/shared/api-client";

interface ScoringPanelProps {
  applicationId: string;
  stage: Stage;
  onStageChange: (stage: Stage) => void;
  /** Cap the panel's own height so its criteria list scrolls internally
   *  while the total/actions stay pinned -- set by the docked (desktop)
   *  and sheet (mobile) wrappers, which know their own available height. */
  className?: string;
  /** Forwarded to AssessmentForm -- see there for what each does. */
  onSubmitSuccess?: (review: ApplicationReviewResponseDto) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * The Application/Interview stage switcher plus the scoring form for
 * whichever stage is active. Shared by the desktop sticky dock and the
 * mobile bottom sheet so there's exactly one scoring UI, not two drifting
 * copies of it.
 *
 * Forwards a ref through to the active AssessmentForm's imperative handle,
 * so the review queue's Cmd+Enter/Ctrl+Enter shortcut can trigger a submit
 * from the page level.
 */
export const ScoringPanel = forwardRef<AssessmentFormHandle, ScoringPanelProps>(function ScoringPanel(
  { applicationId, stage, onStageChange, className, onSubmitSuccess, onDirtyChange },
  ref,
) {
  return (
    <div className={`flex h-full min-h-0 flex-col gap-4 ${className ?? ""}`}>
      <Tabs value={stage} onValueChange={(value) => onStageChange(value as Stage)}>
        <TabsList>
          {STAGES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STAGE_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="min-h-0 flex-1">
        <AssessmentForm
          ref={ref}
          applicationId={applicationId}
          stage={stage}
          layout="panel"
          onSubmitSuccess={onSubmitSuccess}
          onDirtyChange={onDirtyChange}
        />
      </div>
    </div>
  );
});
