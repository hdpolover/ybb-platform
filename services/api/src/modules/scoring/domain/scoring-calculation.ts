// services/api/src/modules/scoring/domain/scoring-calculation.ts
// Pure, dependency-free scoring math. Imported by both the NestJS handlers
// (services/api) and the admin dashboard client (services/admin-dashboard)
// via a path alias, so the live client total and the persisted server total
// can never drift. Do not import anything into this file.

export interface WeightedCriterion {
  criterionId: string;
  criterionWeight: number; // fraction 0..1 within its category
  maxScore: number;
}

export interface WeightedCategory {
  categoryId: string;
  categoryWeight: number; // fraction 0..1 of the whole rubric
  criteria: WeightedCriterion[];
}

export interface ScoreInput {
  criterionId: string;
  score: number;
}

export interface WeightValidationError {
  path: string;
  message: string;
}

export const WEIGHT_SUM_TOLERANCE = 0.0001;

/** total = sum(score * criterionWeight * categoryWeight), rounded to 2dp */
export function calculateWeightedTotal(
  categories: WeightedCategory[],
  scores: ScoreInput[],
): number {
  const scoreByCriterionId = new Map(scores.map((s) => [s.criterionId, s.score]));

  let total = 0;
  for (const category of categories) {
    for (const criterion of category.criteria) {
      const score = scoreByCriterionId.get(criterion.criterionId) ?? 0;
      total += score * criterion.criterionWeight * category.categoryWeight;
    }
  }

  return Math.round(total * 100) / 100;
}

/** Returns [] when every category sums to 1.0 and each category's criteria sum to 1.0, within WEIGHT_SUM_TOLERANCE. */
export function validateWeightSums(
  categories: WeightedCategory[],
): WeightValidationError[] {
  const errors: WeightValidationError[] = [];

  const categoryWeightSum = categories.reduce((sum, c) => sum + c.categoryWeight, 0);
  if (Math.abs(categoryWeightSum - 1) > WEIGHT_SUM_TOLERANCE) {
    errors.push({
      path: 'categories',
      message: `Category weights must sum to 1.0 (currently ${categoryWeightSum.toFixed(4)}).`,
    });
  }

  categories.forEach((category, index) => {
    const criterionWeightSum = category.criteria.reduce((sum, c) => sum + c.criterionWeight, 0);
    if (Math.abs(criterionWeightSum - 1) > WEIGHT_SUM_TOLERANCE) {
      errors.push({
        path: `categories[${index}].criteria`,
        message: `Criteria weights in category "${category.categoryId}" must sum to 1.0 (currently ${criterionWeightSum.toFixed(4)}).`,
      });
    }
  });

  return errors;
}

export type StageOutcome = 'go_to_interview' | 'rejected' | 'finalist' | 'not_selected';

/** application: >= threshold -> go_to_interview, else rejected.
 *  interview:   >= threshold -> finalist,        else not_selected. */
export function resolveStageOutcome(
  stage: 'application' | 'interview',
  total: number,
  passThreshold: number,
): StageOutcome {
  const passed = total >= passThreshold;
  if (stage === 'application') {
    return passed ? 'go_to_interview' : 'rejected';
  }
  return passed ? 'finalist' : 'not_selected';
}

export interface GateState {
  isOpen: boolean;
  reason: 'open' | 'no_application_review' | 'application_draft' | 'below_threshold';
  applicationTotal: number | null;
  applicationThreshold: number | null;
}

export function evaluateInterviewGate(
  applicationReview: { status: 'draft' | 'submitted'; totalScore: number } | null,
  applicationThreshold: number,
): GateState {
  if (!applicationReview) {
    return {
      isOpen: false,
      reason: 'no_application_review',
      applicationTotal: null,
      applicationThreshold,
    };
  }

  if (applicationReview.status === 'draft') {
    return {
      isOpen: false,
      reason: 'application_draft',
      applicationTotal: applicationReview.totalScore,
      applicationThreshold,
    };
  }

  if (applicationReview.totalScore < applicationThreshold) {
    return {
      isOpen: false,
      reason: 'below_threshold',
      applicationTotal: applicationReview.totalScore,
      applicationThreshold,
    };
  }

  return {
    isOpen: true,
    reason: 'open',
    applicationTotal: applicationReview.totalScore,
    applicationThreshold,
  };
}
