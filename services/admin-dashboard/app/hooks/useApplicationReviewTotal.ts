// services/admin-dashboard/app/hooks/useApplicationReviewTotal.ts
"use client";

import { useEffect, useState } from "react";
import { getApplicationReview, ApiError } from "@/src/shared/api-client";
import {
  calculateWeightedTotal,
  WeightedCategory,
  ScoreInput,
} from "@/src/shared/scoring-calculation";
import type { Stage } from "@/app/components/scoring/stage";

/**
 * Read-only preview of the last-saved running total for a review stage.
 * Used only to label the mobile floating "Review" button while the docked
 * scoring panel is collapsed -- it does NOT drive the editable scoring UI.
 * AssessmentForm owns that state (and the live, in-progress total shown
 * inside the panel) completely independently; this hook never touches it.
 *
 * `refreshKey` lets a caller force a refetch (e.g. after the panel sheet
 * closes, to pick up whatever was just saved).
 */
export function useApplicationReviewTotal(
  applicationId: string,
  stage: Stage,
  refreshKey = 0,
): number | null {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;

    getApplicationReview(applicationId, stage)
      .then((review) => {
        if (cancelled) return;
        const weightedCategories: WeightedCategory[] = review.rubric.categories.map((cat) => ({
          categoryId: cat.id,
          categoryWeight: cat.weight,
          criteria: cat.criteria.map((crit) => ({
            criterionId: crit.id,
            criterionWeight: crit.weight,
            maxScore: crit.maxScore,
          })),
        }));
        const scoreInputs: ScoreInput[] = review.scoreItems.map((item) => ({
          criterionId: item.criterionId,
          score: item.score,
        }));
        setTotal(calculateWeightedTotal(weightedCategories, scoreInputs));
      })
      .catch((err) => {
        if (cancelled) return;
        // 409 means no rubric is configured yet -- nothing to preview.
        if (!(err instanceof ApiError && err.status === 409)) {
          setTotal(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, stage, refreshKey]);

  return total;
}
