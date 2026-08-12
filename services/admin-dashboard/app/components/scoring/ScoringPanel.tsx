// services/admin-dashboard/app/components/scoring/ScoringPanel.tsx
"use client";

import { Tabs, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { AssessmentForm } from "@/app/components/scoring/AssessmentForm";
import { STAGES, STAGE_LABELS, type Stage } from "@/app/components/scoring/stage";

interface ScoringPanelProps {
  applicationId: string;
  stage: Stage;
  onStageChange: (stage: Stage) => void;
  /** Cap the panel's own height so its criteria list scrolls internally
   *  while the total/actions stay pinned -- set by the docked (desktop)
   *  and sheet (mobile) wrappers, which know their own available height. */
  className?: string;
}

/**
 * The Application/Interview stage switcher plus the scoring form for
 * whichever stage is active. Shared by the desktop sticky dock and the
 * mobile bottom sheet so there's exactly one scoring UI, not two drifting
 * copies of it.
 */
export function ScoringPanel({ applicationId, stage, onStageChange, className }: ScoringPanelProps) {
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
        <AssessmentForm applicationId={applicationId} stage={stage} layout="panel" />
      </div>
    </div>
  );
}
