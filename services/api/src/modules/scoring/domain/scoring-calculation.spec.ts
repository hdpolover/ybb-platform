// services/api/src/modules/scoring/domain/scoring-calculation.spec.ts
import {
  calculateWeightedTotal,
  validateWeightSums,
  resolveStageOutcome,
  evaluateInterviewGate,
  WEIGHT_SUM_TOLERANCE,
  WeightedCategory,
  ScoreInput,
} from './scoring-calculation';

describe('calculateWeightedTotal', () => {
  const categories: WeightedCategory[] = [
    {
      categoryId: 'cat-achievement',
      categoryWeight: 0.4,
      criteria: [
        { criterionId: 'crit-project', criterionWeight: 0.3, maxScore: 100 },
        { criterionId: 'crit-achievement', criterionWeight: 0.4, maxScore: 100 },
        { criterionId: 'crit-leadership', criterionWeight: 0.3, maxScore: 100 },
      ],
    },
    {
      categoryId: 'cat-essay',
      categoryWeight: 0.6,
      criteria: [
        { criterionId: 'crit-topic', criterionWeight: 0.3, maxScore: 100 },
        { criterionId: 'crit-argument', criterionWeight: 0.5, maxScore: 100 },
        { criterionId: 'crit-sources', criterionWeight: 0.1, maxScore: 100 },
        { criterionId: 'crit-format', criterionWeight: 0.1, maxScore: 100 },
      ],
    },
  ];

  it('computes total = sum(score * criterionWeight * categoryWeight), rounded to 2dp', () => {
    const scores: ScoreInput[] = [
      { criterionId: 'crit-project', score: 80 },
      { criterionId: 'crit-achievement', score: 90 },
      { criterionId: 'crit-leadership', score: 70 },
      { criterionId: 'crit-topic', score: 100 },
      { criterionId: 'crit-argument', score: 85 },
      { criterionId: 'crit-sources', score: 60 },
      { criterionId: 'crit-format', score: 75 },
    ];

    // Achievement: (80*0.3 + 90*0.4 + 70*0.3) * 0.4 = (24+36+21) * 0.4 = 81 * 0.4 = 32.4
    // Essay: (100*0.3 + 85*0.5 + 60*0.1 + 75*0.1) * 0.6 = (30+42.5+6+7.5) * 0.6 = 86 * 0.6 = 51.6
    // Total: 32.4 + 51.6 = 84
    expect(calculateWeightedTotal(categories, scores)).toBe(84);
  });

  it('treats a missing score for a criterion as zero', () => {
    const scores: ScoreInput[] = [{ criterionId: 'crit-project', score: 100 }];
    // Only crit-project contributes: 100 * 0.3 * 0.4 = 12
    expect(calculateWeightedTotal(categories, scores)).toBe(12);
  });

  it('returns 0 for a single category with zero weight', () => {
    const zeroCategories: WeightedCategory[] = [
      {
        categoryId: 'cat-only',
        categoryWeight: 0,
        criteria: [{ criterionId: 'crit-only', criterionWeight: 1, maxScore: 100 }],
      },
    ];
    const scores: ScoreInput[] = [{ criterionId: 'crit-only', score: 100 }];
    expect(calculateWeightedTotal(zeroCategories, scores)).toBe(0);
  });

  it('rounds to exactly two decimal places', () => {
    const oneThirdCategories: WeightedCategory[] = [
      {
        categoryId: 'cat-a',
        categoryWeight: 1,
        criteria: [
          { criterionId: 'c1', criterionWeight: 1 / 3, maxScore: 100 },
          { criterionId: 'c2', criterionWeight: 1 / 3, maxScore: 100 },
          { criterionId: 'c3', criterionWeight: 1 / 3, maxScore: 100 },
        ],
      },
    ];
    const scores: ScoreInput[] = [
      { criterionId: 'c1', score: 100 },
      { criterionId: 'c2', score: 100 },
      { criterionId: 'c3', score: 100 },
    ];
    // (100/3 + 100/3 + 100/3) = 99.999999... -> rounds to 100
    expect(calculateWeightedTotal(oneThirdCategories, scores)).toBe(100);
  });

  it('rounds a raw total sitting on a .xx5 binary floating-point cusp up correctly (1.005 -> 1.01)', () => {
    // categoryWeight=1, criterionWeight=1, score=1.005 -> raw total = 1.005 exactly as parsed.
    // 1.005 * 100 === 100.49999999999999 in JS, so naive Math.round(total*100)/100 yields 1, not 1.01.
    const cuspCategories: WeightedCategory[] = [
      {
        categoryId: 'cat-a',
        categoryWeight: 1,
        criteria: [{ criterionId: 'c1', criterionWeight: 1, maxScore: 100 }],
      },
    ];
    const scores: ScoreInput[] = [{ criterionId: 'c1', score: 1.005 }];
    expect(calculateWeightedTotal(cuspCategories, scores)).toBe(1.01);
  });

  it('rounds a second independent .xx5 binary floating-point cusp up correctly (35.855 -> 35.86)', () => {
    // 35.855 * 100 === 3585.4999999999995 in JS, so naive rounding yields 35.85, not 35.86.
    const cuspCategories: WeightedCategory[] = [
      {
        categoryId: 'cat-a',
        categoryWeight: 1,
        criteria: [{ criterionId: 'c1', criterionWeight: 1, maxScore: 100 }],
      },
    ];
    const scores: ScoreInput[] = [{ criterionId: 'c1', score: 35.855 }];
    expect(calculateWeightedTotal(cuspCategories, scores)).toBe(35.86);
  });
});

describe('validateWeightSums', () => {
  const validCategories: WeightedCategory[] = [
    {
      categoryId: 'cat-a',
      categoryWeight: 0.4,
      criteria: [
        { criterionId: 'c1', criterionWeight: 0.5, maxScore: 100 },
        { criterionId: 'c2', criterionWeight: 0.5, maxScore: 100 },
      ],
    },
    {
      categoryId: 'cat-b',
      categoryWeight: 0.6,
      criteria: [{ criterionId: 'c3', criterionWeight: 1.0, maxScore: 100 }],
    },
  ];

  it('returns [] when categories sum to 1.0 and each category\'s criteria sum to 1.0', () => {
    expect(validateWeightSums(validCategories)).toEqual([]);
  });

  it('accepts a sum within WEIGHT_SUM_TOLERANCE of 1.0', () => {
    const nearlyValid: WeightedCategory[] = [
      {
        categoryId: 'cat-a',
        categoryWeight: 0.4 + WEIGHT_SUM_TOLERANCE / 2,
        criteria: [{ criterionId: 'c1', criterionWeight: 1.0, maxScore: 100 }],
      },
      {
        categoryId: 'cat-b',
        categoryWeight: 0.6 - WEIGHT_SUM_TOLERANCE / 2,
        criteria: [{ criterionId: 'c2', criterionWeight: 1.0, maxScore: 100 }],
      },
    ];
    expect(validateWeightSums(nearlyValid)).toEqual([]);
  });

  it('rejects category weights summing to 0.99', () => {
    const invalid: WeightedCategory[] = [
      {
        categoryId: 'cat-a',
        categoryWeight: 0.39,
        criteria: [{ criterionId: 'c1', criterionWeight: 1.0, maxScore: 100 }],
      },
      {
        categoryId: 'cat-b',
        categoryWeight: 0.6,
        criteria: [{ criterionId: 'c2', criterionWeight: 1.0, maxScore: 100 }],
      },
    ];
    const errors = validateWeightSums(invalid);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe('categories');
    expect(errors[0].message).toMatch(/sum to 1/i);
  });

  it('rejects category weights summing to 1.01', () => {
    const invalid: WeightedCategory[] = [
      {
        categoryId: 'cat-a',
        categoryWeight: 0.41,
        criteria: [{ criterionId: 'c1', criterionWeight: 1.0, maxScore: 100 }],
      },
      {
        categoryId: 'cat-b',
        categoryWeight: 0.6,
        criteria: [{ criterionId: 'c2', criterionWeight: 1.0, maxScore: 100 }],
      },
    ];
    expect(validateWeightSums(invalid).length).toBeGreaterThan(0);
  });

  it('rejects a category whose criteria do not sum to 1.0, path identifies the category', () => {
    const invalid: WeightedCategory[] = [
      {
        categoryId: 'cat-a',
        categoryWeight: 0.4,
        criteria: [
          { criterionId: 'c1', criterionWeight: 0.4, maxScore: 100 },
          { criterionId: 'c2', criterionWeight: 0.4, maxScore: 100 },
        ],
      },
      {
        categoryId: 'cat-b',
        categoryWeight: 0.6,
        criteria: [{ criterionId: 'c3', criterionWeight: 1.0, maxScore: 100 }],
      },
    ];
    const errors = validateWeightSums(invalid);
    expect(errors.length).toBe(1);
    expect(errors[0].path).toBe('categories[0].criteria');
  });
});

describe('resolveStageOutcome', () => {
  it('application stage: at or above threshold resolves to go_to_interview', () => {
    expect(resolveStageOutcome('application', 75, 75)).toBe('go_to_interview');
    expect(resolveStageOutcome('application', 80, 75)).toBe('go_to_interview');
  });

  it('application stage: below threshold resolves to rejected', () => {
    expect(resolveStageOutcome('application', 74.99, 75)).toBe('rejected');
  });

  it('interview stage: at or above threshold resolves to finalist', () => {
    expect(resolveStageOutcome('interview', 75, 75)).toBe('finalist');
  });

  it('interview stage: below threshold resolves to not_selected', () => {
    expect(resolveStageOutcome('interview', 74.99, 75)).toBe('not_selected');
  });
});

describe('evaluateInterviewGate', () => {
  it('is open when the application review is submitted and at or above threshold', () => {
    const gate = evaluateInterviewGate({ status: 'submitted', totalScore: 80 }, 75);
    expect(gate).toEqual({
      isOpen: true,
      reason: 'open',
      applicationTotal: 80,
      applicationThreshold: 75,
    });
  });

  it('is closed with reason no_application_review when null', () => {
    const gate = evaluateInterviewGate(null, 75);
    expect(gate).toEqual({
      isOpen: false,
      reason: 'no_application_review',
      applicationTotal: null,
      applicationThreshold: 75,
    });
  });

  it('is closed with reason application_draft when the review is still draft', () => {
    const gate = evaluateInterviewGate({ status: 'draft', totalScore: 90 }, 75);
    expect(gate).toEqual({
      isOpen: false,
      reason: 'application_draft',
      applicationTotal: 90,
      applicationThreshold: 75,
    });
  });

  it('is closed with reason below_threshold when submitted but under threshold', () => {
    const gate = evaluateInterviewGate({ status: 'submitted', totalScore: 60 }, 75);
    expect(gate).toEqual({
      isOpen: false,
      reason: 'below_threshold',
      applicationTotal: 60,
      applicationThreshold: 75,
    });
  });

  it('is open when the application review totalScore exactly equals the threshold (inclusive boundary)', () => {
    const gate = evaluateInterviewGate({ status: 'submitted', totalScore: 75 }, 75);
    expect(gate).toEqual({
      isOpen: true,
      reason: 'open',
      applicationTotal: 75,
      applicationThreshold: 75,
    });
  });
});
