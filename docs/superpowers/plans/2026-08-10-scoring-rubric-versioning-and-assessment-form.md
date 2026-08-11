# Scoring Rubric Versioning and Assessment Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make per-program scoring rubric weights safely versionable and build the two-stage assessment form that scores applications against them.

**Architecture:** Rubric edits stop mutating rows and instead mint a new immutable `ScoringSchema` version, so `ApplicationReview.schemaId` permanently pins the exact weights a review was scored under. A pure, dependency-free calculation module owns the weighted-total and threshold logic. `services/api` and `services/admin-dashboard` are separate npm packages with no workspace linking, so the module cannot be imported across them; the dashboard keeps a byte-for-byte mirror and a jest guard test in the API fails the build the moment the two diverge. Scoring runs in two stages, `application` and `interview`, each with its own rubric and pass threshold.

**Tech Stack:** NestJS + CQRS, Prisma + PostgreSQL, Next.js 16 admin dashboard (React, TypeScript), jest.

## Global Constraints

- `services/api` uses **npm**, not pnpm. Tests: `npm test -- <path>`. Integration: `npm run test:integration`. Migrations: `npm run prisma:migrate`.
- `services/admin-dashboard` has **no test runner**. Never write a frontend unit or E2E test in this plan. Verify frontend work with `npm run build` and `npm run lint` plus the explicit manual steps each task states.
- Weights are stored as Decimal **fractions** (0 to 1). The UI displays percent. Convert only at the api-client boundary using the existing `percentToFraction` / `fractionToPercent` helpers in `services/admin-dashboard/src/shared/api-client.ts`.
- The admin route param `[programId]` is a **slug**, not a UUID. Every program-scoped API call must resolve it through the existing `useResolvedProgramId` hook first.
- Editing rubric weights stays `SUPER_ADMIN` only. Scoring applications is `ADMIN` and `SUPER_ADMIN`.
- Commit message format: `<type>: <description>` using feat, fix, refactor, docs, test, chore.
- No em dashes in UI copy, comments, or commit messages.
- Never add localStorage autosave to the assessment form.
- Decimal columns are `Decimal(5,2)`, max 999.99. Reject out-of-range values with a 400 before they reach Postgres; never clamp silently.

## Shared Interface Contract

Every task must use these exact names and signatures. Do not rename, do not add synonyms.

Pure calculation module, `services/api/src/modules/scoring/domain/scoring-calculation.ts`:

```ts
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

/** total = sum(score * criterionWeight * categoryWeight), rounded to 2dp */
export function calculateWeightedTotal(
  categories: WeightedCategory[],
  scores: ScoreInput[],
): number;

/** Returns [] when every category sums to 1.0 and each category's criteria sum to 1.0, within WEIGHT_SUM_TOLERANCE. */
export function validateWeightSums(
  categories: WeightedCategory[],
): WeightValidationError[];

export const WEIGHT_SUM_TOLERANCE = 0.0001;

export type StageOutcome = 'go_to_interview' | 'rejected' | 'finalist' | 'not_selected';

/** application: >= threshold -> go_to_interview, else rejected.
 *  interview:   >= threshold -> finalist,        else not_selected. */
export function resolveStageOutcome(
  stage: 'application' | 'interview',
  total: number,
  passThreshold: number,
): StageOutcome;

export interface GateState {
  isOpen: boolean;
  reason: 'open' | 'no_application_review' | 'application_draft' | 'below_threshold';
  applicationTotal: number | null;
  applicationThreshold: number | null;
}

export function evaluateInterviewGate(
  applicationReview: { status: 'draft' | 'submitted'; totalScore: number } | null,
  applicationThreshold: number,
): GateState;
```

This module has zero imports. It is unit-tested on the API side and imported by the admin dashboard through a path alias, so both sides compute identical numbers.

Prisma additions (exact field names):

- `ScoringSchema.version Int @default(1)`
- `ScoringSchema.createdById String? @db.Uuid`
- `ScoringSchema.passThreshold Decimal @db.Decimal(5,2) @default(75)`
- `ScoringSchema @@unique([programId, stage, version])`
- `ApplicationReview.stage ScoringStage`
- `ApplicationReview.overrideById String? @db.Uuid`
- `ApplicationReview.overrideReason String? @db.Text`
- `ApplicationReview.status ReviewStatus` (new enum: `draft`, `submitted`)
- `ApplicationReview @@unique([applicationId, stage])`
- `ScoreStatus` gains `finalist` and `not_selected`

API endpoints (exact shapes):

- `GET  /applications/:applicationId/review?stage=application|interview` returns `ApplicationReviewResponseDto`
- `PUT  /applications/:applicationId/review?stage=application|interview` accepts `UpsertApplicationReviewDto`, returns `ApplicationReviewResponseDto`
- `GET  /programs/:programId/scoring-rubrics?stage=&version=` (existing, gains `version`)
- `PUT  /programs/:programId/scoring-rubrics/:stage` (existing, now mints a version)

`ApplicationReviewResponseDto` carries: `id`, `applicationId`, `stage`, `schemaId`, `schemaVersion`, `status`, `totalScore`, `notes`, `items[]`, `rubric` (resolved categories and criteria with weights and maxScore), `gate` (a `GateState`), and `hasNewerRubricVersion: boolean`.

`UpsertApplicationReviewDto` carries: `status: 'draft' | 'submitted'`, `notes?: string`, `items: { criterionId: string; score: number; notes?: string }[]`, `overrideReason?: string`.

---

## Part A: Backend (Tasks 1-8)

All commands in Tasks 1-8 run from `services/api` unless stated otherwise.
---

### Task 1: Pure scoring calculation module

**Files:**
- Create: `services/api/src/modules/scoring/domain/scoring-calculation.ts`
- Test: `services/api/src/modules/scoring/domain/scoring-calculation.spec.ts`

**Interfaces:**
- Consumes: nothing (zero imports, pure module).
- Produces: `WeightedCriterion`, `WeightedCategory`, `ScoreInput`, `WeightValidationError`, `calculateWeightedTotal(categories, scores)`, `validateWeightSums(categories)`, `WEIGHT_SUM_TOLERANCE`, `StageOutcome`, `resolveStageOutcome(stage, total, passThreshold)`, `GateState`, `evaluateInterviewGate(applicationReview, applicationThreshold)`. Consumed by Task 4 (upsert rubric handler), Task 5 (query handler), Task 7 (get review query), Task 8 (upsert review command), and by Part B's frontend via a path alias.

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/scoring/domain/scoring-calculation.spec.ts`. Expected: FAIL with `Cannot find module './scoring-calculation'`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/modules/scoring/domain/scoring-calculation.spec.ts`. Expected: PASS, all 15 tests green.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/modules/scoring/domain/scoring-calculation.ts services/api/src/modules/scoring/domain/scoring-calculation.spec.ts
git commit -m "feat: add pure scoring calculation module"
```

---

### Task 2: Prisma schema changes and migration

**Files:**
- Modify: `services/api/prisma/schema/scoring.prisma:5-27` (ScoringSchema)
- Modify: `services/api/prisma/schema/scoring.prisma:64-88` (ApplicationReview)
- Modify: `services/api/prisma/schema/enums.prisma:40-45` (ScoreStatus), add new `ReviewStatus` enum in the same file
- Create: `services/api/prisma/migrations/20260810120000_scoring_versioning_and_review_status/migration.sql`
- Test: `services/api/prisma/migrations/20260810120000_scoring_versioning_and_review_status/migration.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ScoringSchema.version`, `ScoringSchema.createdById`, `ScoringSchema.passThreshold`, `ScoringSchema @@unique([programId, stage, version])`, `ApplicationReview.stage`, `ApplicationReview.overrideById`, `ApplicationReview.overrideReason`, `ApplicationReview.status: ReviewStatus`, `ApplicationReview @@unique([applicationId, stage])`, `ScoreStatus.finalist`, `ScoreStatus.not_selected`. Consumed by Task 3 (repository), Task 4/5 (rubric handlers), Task 7/8 (review handlers), and Part B's frontend types.

**Important landmine:** migration `20260621000000_add_scoring_stage` created a **partial unique index** `scoring_schemas_program_id_stage_active_uidx` on `(program_id, stage) WHERE deleted_at IS NULL`. Every existing row has `deleted_at IS NULL`, so once a second version of the same `(program_id, stage)` is inserted (also with `deleted_at IS NULL`), this old index throws a unique-violation. It must be dropped before the new versioned `@@unique([programId, stage, version])` constraint is added.

- [ ] **Step 1: Write the failing test**

```ts
// services/api/prisma/migrations/20260810120000_scoring_versioning_and_review_status/migration.spec.ts
// Integration test against the real test database (see services/api/npm run test:integration
// wiring) — asserts the migration actually reshaped the schema, not just that Prisma types compile.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('20260810120000_scoring_versioning_and_review_status', () => {
  it('adds version, created_by_id, pass_threshold to scoring_schemas with the documented defaults', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; column_default: string | null }>
    >`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'scoring_schemas'
        AND column_name IN ('version', 'created_by_id', 'pass_threshold')
    `;
    const byName = Object.fromEntries(rows.map((r) => [r.column_name, r]));

    expect(byName.version).toBeDefined();
    expect(byName.version.column_default).toContain('1');

    expect(byName.created_by_id).toBeDefined();

    expect(byName.pass_threshold).toBeDefined();
    expect(byName.pass_threshold.data_type).toBe('numeric');
    expect(byName.pass_threshold.column_default).toContain('75');
  });

  it('backfills every existing scoring_schemas row to version=1 and pass_threshold=75', async () => {
    const rows = await prisma.$queryRaw<Array<{ version: number; pass_threshold: string }>>`
      SELECT version, pass_threshold FROM scoring_schemas
    `;
    for (const row of rows) {
      expect(row.version).toBe(1);
      expect(Number(row.pass_threshold)).toBe(75);
    }
  });

  it('drops the old partial unique index and enforces uniqueness on (program_id, stage, version) instead', async () => {
    const oldIndex = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE indexname = 'scoring_schemas_program_id_stage_active_uidx'
    `;
    expect(oldIndex).toEqual([]);

    const newConstraint = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname = 'scoring_schemas_program_id_stage_version_key'
    `;
    expect(newConstraint.length).toBe(1);
  });

  it('converts application_reviews.status to the ReviewStatus enum, defaulting unrecognized values to draft', async () => {
    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'ReviewStatus'
      ORDER BY enumlabel
    `;
    expect(enumValues.map((r) => r.enumlabel)).toEqual(['draft', 'submitted']);

    const columnType = await prisma.$queryRaw<Array<{ udt_name: string }>>`
      SELECT udt_name FROM information_schema.columns
      WHERE table_name = 'application_reviews' AND column_name = 'status'
    `;
    expect(columnType[0].udt_name).toBe('ReviewStatus');
  });

  it('adds finalist and not_selected to ScoreStatus', async () => {
    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'ScoreStatus'
      ORDER BY enumlabel
    `;
    expect(enumValues.map((r) => r.enumlabel)).toEqual(
      expect.arrayContaining(['finalist', 'not_selected']),
    );
  });

  it('adds stage, override_by_id, override_reason to application_reviews and enforces (application_id, stage) uniqueness', async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'application_reviews'
        AND column_name IN ('stage', 'override_by_id', 'override_reason')
    `;
    expect(columns.map((c) => c.column_name).sort()).toEqual([
      'override_by_id',
      'override_reason',
      'stage',
    ]);

    const constraint = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname = 'application_reviews_application_id_stage_key'
    `;
    expect(constraint.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration -- prisma/migrations/20260810120000_scoring_versioning_and_review_status/migration.spec.ts` (from `services/api`). Expected: FAIL. The `version`/`created_by_id`/`pass_threshold` columns don't exist yet, so the first assertion (`byName.version` defined) fails, and the `ReviewStatus`/constraint queries return empty arrays against the pre-migration schema.

- [ ] **Step 3: Edit the Prisma schema — ScoringSchema**

```prisma
// services/api/prisma/schema/scoring.prisma:5-27
model ScoringSchema {
  id            String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  programId     String  @map("program_id") @db.Uuid
  name          String  @db.VarChar(255) // e.g., "IYS 2026 Selection Rubric"
  description   String? @db.Text
  isActive      Boolean      @default(true) @map("is_active")
  stage         ScoringStage @default(application) @map("stage")
  version       Int          @default(1)
  createdById   String?      @map("created_by_id") @db.Uuid
  passThreshold Decimal      @default(75) @map("pass_threshold") @db.Decimal(5, 2)

  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)
  legacyId  Int?      @unique @map("legacy_id")

  // Relations
  program    Program             @relation(fields: [programId], references: [id], onDelete: Cascade)
  createdBy  Admin?              @relation(fields: [createdById], references: [id])
  categories ScoringCategory[]
  reviews    ApplicationReview[]

  @@unique([programId, stage, version])
  @@index([programId])
  @@index([isActive])
  @@index([programId, stage])
  @@map("scoring_schemas")
}
```

- [ ] **Step 4: Edit the Prisma schema — ApplicationReview**

```prisma
// services/api/prisma/schema/scoring.prisma:64-88
model ApplicationReview {
  id            String @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  applicationId String @map("application_id") @db.Uuid
  schemaId      String @map("schema_id") @db.Uuid
  reviewerId    String @map("reviewer_id") @db.Uuid
  stage         ScoringStage @map("stage")

  totalScore     Decimal      @map("total_score") @db.Decimal(5, 2) // Calculated total
  notes          String?      @db.Text
  status         ReviewStatus @default(draft)
  overrideById   String?      @map("override_by_id") @db.Uuid
  overrideReason String?      @map("override_reason") @db.Text

  startedAt   DateTime  @default(now()) @map("started_at") @db.Timestamptz(6)
  completedAt DateTime? @map("completed_at") @db.Timestamptz(6)

  // Relations
  application ParticipantApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  schema      ScoringSchema          @relation(fields: [schemaId], references: [id])
  reviewer    Admin                  @relation(fields: [reviewerId], references: [id])
  overrideBy  Admin?                 @relation("ApplicationReviewOverrideBy", fields: [overrideById], references: [id])

  items ApplicationScoreItem[]

  @@unique([applicationId, stage])
  @@index([applicationId])
  @@index([reviewerId])
  @@index([schemaId])
  @@map("application_reviews")
}
```

Note the `reviewer` relation and the new `overrideBy` relation both point to `Admin`; Prisma requires a relation name to disambiguate two relations between the same two models, hence `@relation("ApplicationReviewOverrideBy", ...)`. The `reviewer` relation is left as the implicit/default relation since it was there first and changing its name would rename the underlying FK constraint.

- [ ] **Step 5: Edit the Prisma schema — enums**

```prisma
// services/api/prisma/schema/enums.prisma:40-45
enum ScoreStatus {
  pending
  scored
  go_to_interview
  rejected
  finalist
  not_selected
}

enum ReviewStatus {
  draft
  submitted
}
```

- [ ] **Step 6: Generate the migration skeleton**

Run: `npx prisma migrate dev --name scoring_versioning_and_review_status --create-only` (from `services/api`). This writes `prisma/migrations/<timestamp>_scoring_versioning_and_review_status/migration.sql` with Prisma's auto-generated diff. Do not apply it yet — the next step replaces its contents with the hand-ordered version below, because Prisma's naive diff would try to add the unique constraints and the enum conversion in one unsafe pass.

- [ ] **Step 7: Replace the generated migration.sql with the ordered, safe version**

```sql
-- services/api/prisma/migrations/20260810120000_scoring_versioning_and_review_status/migration.sql

-- ============================================================================
-- Step 1: Add new columns nullable / with defaults (safe on a live table).
-- ============================================================================
ALTER TABLE "scoring_schemas" ADD COLUMN "version" INTEGER;
ALTER TABLE "scoring_schemas" ADD COLUMN "created_by_id" UUID;
ALTER TABLE "scoring_schemas" ADD COLUMN "pass_threshold" DECIMAL(5,2);

ALTER TABLE "application_reviews" ADD COLUMN "override_by_id" UUID;
ALTER TABLE "application_reviews" ADD COLUMN "override_reason" TEXT;

-- ============================================================================
-- Step 2: Backfill version = 1 for every existing ScoringSchema row.
-- ============================================================================
UPDATE "scoring_schemas" SET "version" = 1 WHERE "version" IS NULL;
ALTER TABLE "scoring_schemas" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE "scoring_schemas" ALTER COLUMN "version" SET DEFAULT 1;

-- ============================================================================
-- Step 3: Backfill passThreshold = 75 to match the legacy hardcoded cutoff.
-- ============================================================================
UPDATE "scoring_schemas" SET "pass_threshold" = 75 WHERE "pass_threshold" IS NULL;
ALTER TABLE "scoring_schemas" ALTER COLUMN "pass_threshold" SET NOT NULL;
ALTER TABLE "scoring_schemas" ALTER COLUMN "pass_threshold" SET DEFAULT 75;

-- created_by_id stays nullable: pre-existing rows have no known author.
ALTER TABLE "scoring_schemas"
  ADD CONSTRAINT "scoring_schemas_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "application_reviews"
  ADD CONSTRAINT "application_reviews_override_by_id_fkey"
  FOREIGN KEY ("override_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Step 4: Create the ReviewStatus enum and cast application_reviews.status,
-- with an explicit USING clause defaulting any unrecognized value to 'draft'.
-- The column was VARCHAR(50) holding only 'draft'/'submitted' in practice,
-- but the USING clause guards against any stray/legacy value blowing up the
-- cast instead of failing the whole migration.
-- ============================================================================
CREATE TYPE "ReviewStatus" AS ENUM ('draft', 'submitted');

ALTER TABLE "application_reviews" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "application_reviews"
  ALTER COLUMN "status" TYPE "ReviewStatus"
  USING (
    CASE
      WHEN "status" IN ('draft', 'submitted') THEN "status"::"ReviewStatus"
      ELSE 'draft'::"ReviewStatus"
    END
  );
ALTER TABLE "application_reviews" ALTER COLUMN "status" SET DEFAULT 'draft';

-- ============================================================================
-- Step 5: Add finalist and not_selected to ScoreStatus. Additive only —
-- 'scored' stays in the enum unused rather than being removed.
-- ============================================================================
ALTER TYPE "ScoreStatus" ADD VALUE IF NOT EXISTS 'finalist';
ALTER TYPE "ScoreStatus" ADD VALUE IF NOT EXISTS 'not_selected';

-- ============================================================================
-- Step 6: Backfill ApplicationReview.stage from its pinned schema. Add the
-- column nullable first so the backfill has somewhere to write, then
-- tighten to NOT NULL once every row is populated.
-- ============================================================================
ALTER TABLE "application_reviews" ADD COLUMN "stage" "ScoringStage";

UPDATE "application_reviews" ar
SET "stage" = ss."stage"
FROM "scoring_schemas" ss
WHERE ar."schema_id" = ss."id";

ALTER TABLE "application_reviews" ALTER COLUMN "stage" SET NOT NULL;

-- ============================================================================
-- Step 7: Deduplicate any existing ApplicationReview rows sharing
-- (application_id, stage), keeping the most recently updated. The table has
-- no updated_at column, so "most recently updated" is approximated as
-- COALESCE(completed_at, started_at) DESC, with id DESC as a final tiebreak
-- for exact ties. Expected to delete zero rows in practice (design doc:
-- nothing writes these rows today) but the migration must not assume that.
-- ============================================================================
DELETE FROM "application_reviews" ar
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "application_id", "stage"
      ORDER BY COALESCE("completed_at", "started_at") DESC, "id" DESC
    ) AS rn
  FROM "application_reviews"
) ranked
WHERE ar."id" = ranked."id" AND ranked."rn" > 1;

-- ============================================================================
-- Step 8: Apply constraints, now that the data satisfies them.
-- ============================================================================

-- The old partial unique index enforced "one active schema per (program,
-- stage)" via deleted_at IS NULL. Every version now has deleted_at IS NULL,
-- so this index must go before the versioned unique constraint can hold.
DROP INDEX IF EXISTS "scoring_schemas_program_id_stage_active_uidx";

ALTER TABLE "scoring_schemas"
  ADD CONSTRAINT "scoring_schemas_program_id_stage_version_key"
  UNIQUE ("program_id", "stage", "version");

ALTER TABLE "application_reviews"
  ADD CONSTRAINT "application_reviews_application_id_stage_key"
  UNIQUE ("application_id", "stage");
```

- [ ] **Step 8: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev` (from `services/api`) to apply the hand-edited SQL against the local dev database, then `npx prisma generate` to regenerate the Prisma client with the new fields and enums. Confirm `npx prisma validate` reports no schema errors.

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test:integration -- prisma/migrations/20260810120000_scoring_versioning_and_review_status/migration.spec.ts` (from `services/api`). Expected: PASS, all 6 assertions green against the migrated test database.

- [ ] **Step 10: Commit**

```bash
git add services/api/prisma/schema/scoring.prisma services/api/prisma/schema/enums.prisma services/api/prisma/migrations/20260810120000_scoring_versioning_and_review_status
git commit -m "feat: version scoring rubrics and add ReviewStatus enum to application reviews"
```

---

### Task 3: Versioned rubric upsert repository

**Files:**
- Modify: `services/api/src/core/interfaces/repositories/scoring-rubric.repository.interface.ts` (full rewrite)
- Modify: `services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.ts` (full rewrite)
- Test: `services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts` (full rewrite, replaces the old mutate-in-place test suite)

**Interfaces:**
- Consumes: `ScoringSchema.version/createdById/passThreshold` and `@@unique([programId, stage, version])` from Task 2.
- Produces: `IScoringRubricRepository` with `findActiveRubric`, `findRubricVersion`, `findRubricHistory`, `mintRubricVersion`; `ScoringSchemaWithNested` (gains `version`, `createdById`, `passThreshold`); `UpsertRubricPayload` (gains `passThreshold?`). Consumed by Task 4 (upsert handler), Task 5 (query handler), Task 6 (controller).

- [ ] **Step 1: Write the failing test**

```ts
// services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts
import { Prisma, ScoringStage } from '@prisma/client';
import { ScoringRubricRepository } from './scoring-rubric.repository';
import { UpsertRubricPayload } from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

describe('ScoringRubricRepository', () => {
  let repo: ScoringRubricRepository;
  let mockPrisma: {
    scoringSchema: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    scoringCategory: { create: jest.Mock };
    scoringCriterion: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const programId = 'prog-uuid-1';
  const activeSchemaId = 'schema-uuid-v1';
  const catId = 'cat-uuid-1';
  const critId = 'crit-uuid-1';

  const makeActiveSchema = () => ({
    id: activeSchemaId,
    programId,
    stage: ScoringStage.application,
    name: 'Test Rubric',
    description: null,
    isActive: true,
    version: 1,
    createdById: null,
    passThreshold: new Prisma.Decimal(75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [
      {
        id: catId,
        schemaId: activeSchemaId,
        name: 'Essay',
        description: null,
        weight: new Prisma.Decimal(0.6),
        order: 0,
        legacyId: null,
        criteria: [
          {
            id: critId,
            categoryId: catId,
            name: 'Topic Relevance',
            description: null,
            weight: new Prisma.Decimal(1.0),
            maxScore: new Prisma.Decimal(100),
            order: 0,
            legacyId: null,
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    mockPrisma = {
      scoringSchema: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      scoringCategory: { create: jest.fn() },
      scoringCriterion: { create: jest.fn() },
      // $transaction executes the callback synchronously in tests, passing mockPrisma as `tx`.
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    repo = new ScoringRubricRepository(mockPrisma as any);
  });

  describe('findActiveRubric', () => {
    it('returns the active version for a program/stage', async () => {
      const active = makeActiveSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(active);

      const result = await repo.findActiveRubric(programId, ScoringStage.application);

      expect(mockPrisma.scoringSchema.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId, stage: ScoringStage.application, isActive: true, deletedAt: null },
        }),
      );
      expect(result).toEqual(active);
    });

    it('returns null when no active rubric exists', async () => {
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(null);
      const result = await repo.findActiveRubric(programId, ScoringStage.interview);
      expect(result).toBeNull();
    });
  });

  describe('findRubricVersion', () => {
    it('returns the specific version regardless of active status', async () => {
      const version2 = { ...makeActiveSchema(), id: 'schema-uuid-v2', version: 2, isActive: true };
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(version2);

      const result = await repo.findRubricVersion(programId, ScoringStage.application, 2);

      expect(mockPrisma.scoringSchema.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId, stage: ScoringStage.application, version: 2, deletedAt: null },
        }),
      );
      expect(result).toEqual(version2);
    });
  });

  describe('findRubricHistory', () => {
    it('returns all versions ordered by version descending', async () => {
      const rows = [{ ...makeActiveSchema(), version: 2 }, { ...makeActiveSchema(), version: 1 }];
      mockPrisma.scoringSchema.findMany.mockResolvedValue(rows);

      const result = await repo.findRubricHistory(programId, ScoringStage.application);

      expect(mockPrisma.scoringSchema.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId, stage: ScoringStage.application, deletedAt: null },
          orderBy: { version: 'desc' },
        }),
      );
      expect(result).toEqual(rows);
    });
  });

  describe('mintRubricVersion', () => {
    const payload: UpsertRubricPayload = {
      name: 'Test Rubric',
      passThreshold: 75,
      categories: [
        {
          name: 'Essay',
          weight: 0.6,
          order: 0,
          criteria: [{ name: 'Topic Relevance', weight: 1.0, maxScore: 100, order: 0 }],
        },
      ],
    };

    it('creates version 1 when no active rubric exists yet', async () => {
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(null);
      const created = { ...makeActiveSchema(), categories: [] };
      mockPrisma.scoringSchema.create.mockResolvedValue(created);
      mockPrisma.scoringCategory.create.mockResolvedValue({ ...created.categories[0], id: catId, criteria: [] });
      mockPrisma.scoringCriterion.create.mockResolvedValue({ id: critId });
      mockPrisma.scoringSchema.findMany.mockResolvedValue([makeActiveSchema()]);

      const result = await repo.mintRubricVersion(programId, ScoringStage.application, payload, 'admin-1');

      expect(mockPrisma.scoringSchema.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            programId,
            stage: ScoringStage.application,
            version: 1,
            isActive: true,
            createdById: 'admin-1',
            passThreshold: 75,
          }),
        }),
      );
      expect(result.version).toBe(1);
    });

    it('mints version 2 and flips version 1 inactive when the payload differs from the active version', async () => {
      const active = makeActiveSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(active);
      const changedPayload: UpsertRubricPayload = {
        ...payload,
        categories: [
          {
            ...payload.categories[0],
            criteria: [{ name: 'Topic Relevance', weight: 0.9, maxScore: 100, order: 0 }],
          },
        ],
      };
      const createdV2 = { ...active, id: 'schema-uuid-v2', version: 2 };
      mockPrisma.scoringSchema.create.mockResolvedValue(createdV2);
      mockPrisma.scoringCategory.create.mockResolvedValue({ ...active.categories[0], criteria: [] });
      mockPrisma.scoringCriterion.create.mockResolvedValue(active.categories[0].criteria[0]);
      mockPrisma.scoringSchema.findMany.mockResolvedValue([createdV2]);

      const result = await repo.mintRubricVersion(programId, ScoringStage.application, changedPayload, 'admin-1');

      expect(mockPrisma.scoringSchema.update).toHaveBeenCalledWith({
        where: { id: activeSchemaId },
        data: { isActive: false },
      });
      expect(mockPrisma.scoringSchema.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 2, isActive: true }) }),
      );
      expect(result.version).toBe(2);
    });

    it('returns the existing active version unchanged and mints nothing when the payload is semantically identical', async () => {
      const active = makeActiveSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(active);

      const result = await repo.mintRubricVersion(programId, ScoringStage.application, payload, 'admin-1');

      expect(mockPrisma.scoringSchema.create).not.toHaveBeenCalled();
      expect(mockPrisma.scoringSchema.update).not.toHaveBeenCalled();
      expect(result).toEqual(active);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts` (from `services/api`). Expected: FAIL with `repo.findActiveRubric is not a function` (the current repository only exposes `findRubricsByProgramId`/`upsertRubric`).

- [ ] **Step 3: Rewrite the repository interface**

```ts
// services/api/src/core/interfaces/repositories/scoring-rubric.repository.interface.ts
import { ScoringStage } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type ScoringCriterionNested = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  weight: Prisma.Decimal;
  maxScore: Prisma.Decimal;
  order: number;
  legacyId: number | null;
};

export type ScoringCategoryNested = {
  id: string;
  schemaId: string;
  name: string;
  description: string | null;
  weight: Prisma.Decimal;
  order: number;
  legacyId: string | null;
  criteria: ScoringCriterionNested[];
};

export type ScoringSchemaWithNested = {
  id: string;
  programId: string;
  stage: ScoringStage;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  createdById: string | null;
  passThreshold: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  legacyId: number | null;
  categories: ScoringCategoryNested[];
};

export type UpsertCriterionPayload = {
  name: string;
  description?: string;
  weight: number;
  maxScore: number;
  order: number;
};

export type UpsertCategoryPayload = {
  name: string;
  description?: string;
  weight: number;
  order: number;
  criteria: UpsertCriterionPayload[];
};

export type UpsertRubricPayload = {
  name?: string;
  description?: string;
  passThreshold?: number;
  categories: UpsertCategoryPayload[];
};

export interface IScoringRubricRepository {
  /** The current version, or null if the program/stage has never had a rubric. */
  findActiveRubric(
    programId: string,
    stage: ScoringStage,
  ): Promise<ScoringSchemaWithNested | null>;

  /** A specific past or present version, for history inspection. */
  findRubricVersion(
    programId: string,
    stage: ScoringStage,
    version: number,
  ): Promise<ScoringSchemaWithNested | null>;

  /** Every version for a program/stage, newest first. */
  findRubricHistory(
    programId: string,
    stage: ScoringStage,
  ): Promise<ScoringSchemaWithNested[]>;

  /**
   * Deep-copies the payload into a new ScoringSchema version and flips the
   * previous active version (if any) to isActive=false. A payload that is
   * semantically identical to the current active version (same names,
   * descriptions, weights, maxScore, order, and row count) mints nothing
   * and returns the existing active version unchanged.
   */
  mintRubricVersion(
    programId: string,
    stage: ScoringStage,
    payload: UpsertRubricPayload,
    createdById: string | null,
  ): Promise<ScoringSchemaWithNested>;
}
```

- [ ] **Step 4: Rewrite the repository implementation**

```ts
// services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
  UpsertRubricPayload,
  UpsertCategoryPayload,
} from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

const CATEGORIES_INCLUDE = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: {
      criteria: {
        orderBy: { order: 'asc' as const },
      },
    },
  },
};

function toNumber(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

/**
 * True when `payload` describes the exact same rubric shape as `active`:
 * same category count/order/name/description/weight, same criteria
 * count/order/name/description/weight/maxScore within each category.
 * Row ids are intentionally ignored — a payload built from a fresh GET
 * always round-trips ids, but a hand-authored payload never has them.
 */
function isSemanticallyIdentical(
  active: ScoringSchemaWithNested,
  payload: UpsertRubricPayload,
): boolean {
  if ((payload.name ?? active.name) !== active.name) return false;
  if ((payload.description ?? null) !== (active.description ?? null)) return false;
  if ((payload.passThreshold ?? toNumber(active.passThreshold)) !== toNumber(active.passThreshold)) {
    return false;
  }
  if (payload.categories.length !== active.categories.length) return false;

  const sortedActive = [...active.categories].sort((a, b) => a.order - b.order);
  const sortedPayload = [...payload.categories].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sortedActive.length; i++) {
    const a = sortedActive[i];
    const p = sortedPayload[i];
    if (a.name !== p.name) return false;
    if ((a.description ?? null) !== (p.description ?? null)) return false;
    if (toNumber(a.weight) !== p.weight) return false;
    if (a.order !== p.order) return false;
    if (a.criteria.length !== p.criteria.length) return false;

    const sortedActiveCriteria = [...a.criteria].sort((x, y) => x.order - y.order);
    const sortedPayloadCriteria = [...p.criteria].sort((x, y) => x.order - y.order);

    for (let j = 0; j < sortedActiveCriteria.length; j++) {
      const ac = sortedActiveCriteria[j];
      const pc = sortedPayloadCriteria[j];
      if (ac.name !== pc.name) return false;
      if ((ac.description ?? null) !== (pc.description ?? null)) return false;
      if (toNumber(ac.weight) !== pc.weight) return false;
      if (toNumber(ac.maxScore) !== pc.maxScore) return false;
      if (ac.order !== pc.order) return false;
    }
  }

  return true;
}

@Injectable()
export class ScoringRubricRepository implements IScoringRubricRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveRubric(
    programId: string,
    stage: ScoringStage,
  ): Promise<ScoringSchemaWithNested | null> {
    return this.prisma.scoringSchema.findFirst({
      where: { programId, stage, isActive: true, deletedAt: null },
      include: CATEGORIES_INCLUDE,
    }) as Promise<ScoringSchemaWithNested | null>;
  }

  async findRubricVersion(
    programId: string,
    stage: ScoringStage,
    version: number,
  ): Promise<ScoringSchemaWithNested | null> {
    return this.prisma.scoringSchema.findFirst({
      where: { programId, stage, version, deletedAt: null },
      include: CATEGORIES_INCLUDE,
    }) as Promise<ScoringSchemaWithNested | null>;
  }

  async findRubricHistory(
    programId: string,
    stage: ScoringStage,
  ): Promise<ScoringSchemaWithNested[]> {
    return this.prisma.scoringSchema.findMany({
      where: { programId, stage, deletedAt: null },
      orderBy: { version: 'desc' },
      include: CATEGORIES_INCLUDE,
    }) as Promise<ScoringSchemaWithNested[]>;
  }

  async mintRubricVersion(
    programId: string,
    stage: ScoringStage,
    payload: UpsertRubricPayload,
    createdById: string | null,
  ): Promise<ScoringSchemaWithNested> {
    return this.prisma.$transaction(async (tx) => {
      const active = await tx.scoringSchema.findFirst({
        where: { programId, stage, isActive: true, deletedAt: null },
        include: CATEGORIES_INCLUDE,
      }) as ScoringSchemaWithNested | null;

      if (active && isSemanticallyIdentical(active, payload)) {
        return active;
      }

      const nextVersion = active ? active.version + 1 : 1;

      if (active) {
        await tx.scoringSchema.update({
          where: { id: active.id },
          data: { isActive: false },
        });
      }

      const created = await tx.scoringSchema.create({
        data: {
          programId,
          stage,
          name: payload.name ?? active?.name ?? `${stage} Rubric`,
          description: payload.description ?? active?.description ?? null,
          isActive: true,
          version: nextVersion,
          createdById,
          passThreshold: payload.passThreshold ?? (active ? toNumber(active.passThreshold) : 75),
        },
      });

      for (const cat of payload.categories) {
        await this.createCategoryWithCriteria(tx, created.id, cat);
      }

      const rows = await tx.scoringSchema.findMany({
        where: { id: created.id },
        include: CATEGORIES_INCLUDE,
      });

      const result = rows[0];
      if (!result) throw new Error(`ScoringSchema ${created.id} disappeared mid-transaction`);
      return result as ScoringSchemaWithNested;
    });
  }

  private async createCategoryWithCriteria(
    tx: Prisma.TransactionClient,
    schemaId: string,
    cat: UpsertCategoryPayload,
  ): Promise<void> {
    const createdCategory = await tx.scoringCategory.create({
      data: {
        schemaId,
        name: cat.name,
        description: cat.description ?? null,
        weight: cat.weight,
        order: cat.order,
      },
    });

    for (const crit of cat.criteria) {
      await tx.scoringCriterion.create({
        data: {
          categoryId: createdCategory.id,
          name: crit.name,
          description: crit.description ?? null,
          weight: crit.weight,
          maxScore: crit.maxScore,
          order: crit.order,
        },
      });
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts` (from `services/api`). Expected: PASS, all 8 tests green.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/core/interfaces/repositories/scoring-rubric.repository.interface.ts services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.ts services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts
git commit -m "feat: mint immutable scoring rubric versions instead of mutating in place"
```

---

### Task 4: Rubric upsert handler with weight-sum validation

**Files:**
- Modify: `services/api/src/modules/programs/application/commands/upsert-scoring-rubric.command.ts`
- Modify: `services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.ts`
- Modify: `services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts:141-162` (`RubricDto` gains `version`, `passThreshold`)
- Test: `services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts` (full rewrite)

**Interfaces:**
- Consumes: `validateWeightSums`, `WeightValidationError`, `WEIGHT_SUM_TOLERANCE` from Task 1 (`services/api/src/modules/scoring/domain/scoring-calculation.ts`); `IScoringRubricRepository.mintRubricVersion` from Task 3.
- Produces: `UpsertScoringRubricCommand(programId, stage, payload, createdById)`; `UpsertScoringRubricHandler.execute(command): Promise<RubricDto>` where `RubricDto` now carries `version: number` and `passThreshold: number`. Consumed by Task 6 (controller).

- [ ] **Step 1: Write the failing test**

```ts
// services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts
import { BadRequestException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { UpsertScoringRubricHandler } from './upsert-scoring-rubric.handler';
import { UpsertScoringRubricCommand } from '../upsert-scoring-rubric.command';

const programId = 'prog-uuid-1';

const validPayload = {
  name: 'Application Rubric',
  passThreshold: 75,
  categories: [
    {
      name: 'Achievement',
      weight: 0.4,
      order: 0,
      criteria: [{ name: 'Leadership', weight: 1.0, maxScore: 100, order: 0 }],
    },
    {
      name: 'Essay',
      weight: 0.6,
      order: 1,
      criteria: [{ name: 'Relevance', weight: 1.0, maxScore: 100, order: 0 }],
    },
  ],
};

const fakeMintedResult = {
  id: 'schema-1',
  programId,
  stage: ScoringStage.application,
  name: 'Application Rubric',
  description: null,
  isActive: true,
  version: 2,
  createdById: 'admin-1',
  passThreshold: new Prisma.Decimal(75),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  legacyId: null,
  categories: [
    {
      id: 'cat-1',
      schemaId: 'schema-1',
      name: 'Achievement',
      description: null,
      weight: new Prisma.Decimal(0.4),
      order: 0,
      legacyId: null,
      criteria: [
        {
          id: 'crit-1',
          categoryId: 'cat-1',
          name: 'Leadership',
          description: null,
          weight: new Prisma.Decimal(1.0),
          maxScore: new Prisma.Decimal(100),
          order: 0,
          legacyId: null,
        },
      ],
    },
    {
      id: 'cat-2',
      schemaId: 'schema-1',
      name: 'Essay',
      description: null,
      weight: new Prisma.Decimal(0.6),
      order: 1,
      legacyId: null,
      criteria: [
        {
          id: 'crit-2',
          categoryId: 'cat-2',
          name: 'Relevance',
          description: null,
          weight: new Prisma.Decimal(1.0),
          maxScore: new Prisma.Decimal(100),
          order: 0,
          legacyId: null,
        },
      ],
    },
  ],
};

describe('UpsertScoringRubricHandler', () => {
  let handler: UpsertScoringRubricHandler;
  let mockRepo: { mintRubricVersion: jest.Mock };

  beforeEach(() => {
    mockRepo = { mintRubricVersion: jest.fn().mockResolvedValue(fakeMintedResult) };
    handler = new UpsertScoringRubricHandler(mockRepo as any);
  });

  it('mints a version and returns a RubricDto carrying version and passThreshold', async () => {
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, validPayload, 'admin-1');
    const result = await handler.execute(cmd);

    expect(mockRepo.mintRubricVersion).toHaveBeenCalledWith(
      programId,
      ScoringStage.application,
      validPayload,
      'admin-1',
    );
    expect(result.id).toBe('schema-1');
    expect(result.version).toBe(2);
    expect(result.passThreshold).toBe(75);
    expect(result.categories).toHaveLength(2);
  });

  it('throws BadRequestException with field-level errors when category weights do not sum to 1.0', async () => {
    const payload = {
      ...validPayload,
      categories: [
        { ...validPayload.categories[0], weight: 0.3 },
        validPayload.categories[1],
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');

    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
    expect(mockRepo.mintRubricVersion).not.toHaveBeenCalled();

    try {
      await handler.execute(cmd);
      fail('expected BadRequestException');
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string }> };
      expect(response.errors[0].path).toBe('categories');
    }
  });

  it('throws BadRequestException with field-level errors when a category\'s criteria do not sum to 1.0', async () => {
    const payload = {
      ...validPayload,
      categories: [
        {
          ...validPayload.categories[0],
          criteria: [
            { name: 'Leadership', weight: 0.5, maxScore: 100, order: 0 },
            { name: 'Initiative', weight: 0.3, maxScore: 100, order: 1 },
          ],
        },
        validPayload.categories[1],
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');

    try {
      await handler.execute(cmd);
      fail('expected BadRequestException');
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string }> };
      expect(response.errors[0].path).toBe('categories[0].criteria');
    }
  });

  it('throws BadRequestException when a category weight is negative', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: -0.1, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a criterion maxScore is zero or negative', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: 1, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 0, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a category name is empty', async () => {
    const payload = {
      categories: [
        { name: '', weight: 1, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload, 'admin-1');
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts` (from `services/api`). Expected: FAIL — `mockRepo.mintRubricVersion` is never called because the handler still calls `repo.upsertRubric`, and `UpsertScoringRubricCommand` does not accept a fourth `createdById` argument yet (TS compile error surfaces as a Jest failure).

- [ ] **Step 3: Update the command**

```ts
// services/api/src/modules/programs/application/commands/upsert-scoring-rubric.command.ts
import { ScoringStage } from '@prisma/client';
import { UpsertRubricPayload } from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

export class UpsertScoringRubricCommand {
  constructor(
    public readonly programId: string,
    public readonly stage: ScoringStage,
    public readonly payload: UpsertRubricPayload,
    public readonly createdById: string | null,
  ) {}
}
```

- [ ] **Step 4: Update `RubricDto` to carry version and passThreshold**

```ts
// services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts:141-162
export class RubricDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  programId!: string;

  @ApiProperty()
  stage!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  passThreshold!: number;

  @ApiProperty({ type: () => RubricCategoryDto, isArray: true })
  categories!: RubricCategoryDto[];
}
```

- [ ] **Step 5: Rewrite the handler**

```ts
// services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
  UpsertRubricPayload,
} from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { UpsertScoringRubricCommand } from '../upsert-scoring-rubric.command';
import { RubricDto, RubricCategoryDto, RubricCriterionDto } from '../../../presentation/dto/scoring-rubric.dto';
import {
  validateWeightSums,
  WeightedCategory,
} from '../../../../scoring/domain/scoring-calculation';

function toNumber(value: Prisma.Decimal | number): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

function mapToRubricDto(schema: ScoringSchemaWithNested): RubricDto {
  const categories: RubricCategoryDto[] = schema.categories.map((cat) => {
    const criteria: RubricCriterionDto[] = cat.criteria.map((crit) => ({
      id: crit.id,
      name: crit.name,
      description: crit.description,
      weight: toNumber(crit.weight),
      maxScore: toNumber(crit.maxScore),
      order: crit.order,
    }));
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      weight: toNumber(cat.weight),
      order: cat.order,
      criteria,
    };
  });
  return {
    id: schema.id,
    programId: schema.programId,
    stage: schema.stage,
    name: schema.name,
    description: schema.description,
    isActive: schema.isActive,
    version: schema.version,
    passThreshold: toNumber(schema.passThreshold),
    categories,
  };
}

function validateRowShapes(payload: UpsertRubricPayload): void {
  for (const cat of payload.categories) {
    if (!cat.name || cat.name.trim().length === 0) {
      throw new BadRequestException('Category name must not be empty');
    }
    if (cat.weight < 0) {
      throw new BadRequestException(`Category "${cat.name}" weight must be >= 0`);
    }
    for (const crit of cat.criteria) {
      if (!crit.name || crit.name.trim().length === 0) {
        throw new BadRequestException('Criterion name must not be empty');
      }
      if (crit.weight < 0) {
        throw new BadRequestException(`Criterion "${crit.name}" weight must be >= 0`);
      }
      if (crit.maxScore <= 0) {
        throw new BadRequestException(`Criterion "${crit.name}" maxScore must be > 0`);
      }
    }
  }
}

function toWeightedCategories(payload: UpsertRubricPayload): WeightedCategory[] {
  return payload.categories.map((cat, i) => ({
    categoryId: `categories[${i}]`,
    categoryWeight: cat.weight,
    criteria: cat.criteria.map((crit) => ({
      criterionId: crit.name,
      criterionWeight: crit.weight,
      maxScore: crit.maxScore,
    })),
  }));
}

@Injectable()
export class UpsertScoringRubricHandler {
  constructor(
    @Inject('IScoringRubricRepository')
    private readonly repo: IScoringRubricRepository,
  ) {}

  async execute(command: UpsertScoringRubricCommand): Promise<RubricDto> {
    validateRowShapes(command.payload);

    const weightErrors = validateWeightSums(toWeightedCategories(command.payload));
    if (weightErrors.length > 0) {
      throw new BadRequestException({
        message: 'Rubric weights are invalid.',
        errors: weightErrors,
      });
    }

    const result = await this.repo.mintRubricVersion(
      command.programId,
      command.stage,
      command.payload,
      command.createdById,
    );
    return mapToRubricDto(result);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts` (from `services/api`). Expected: PASS, all 7 tests green.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/modules/programs/application/commands/upsert-scoring-rubric.command.ts services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.ts services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts
git commit -m "feat: validate rubric weight sums and mint versions on upsert"
```

---

### Task 5: Rubric query handler with version support

**Files:**
- Modify: `services/api/src/modules/programs/application/queries/get-scoring-rubrics.query.ts`
- Modify: `services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.ts`
- Test: `services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts` (full rewrite)
- Create: `services/api/src/modules/programs/application/queries/get-scoring-rubric-versions.query.ts`
- Create: `services/api/src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.ts`
- Modify: `services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts` (add `RubricVersionSummaryDto`, appended at end of file)
- Modify: `services/api/src/modules/programs/programs.module.ts` (register `GetScoringRubricVersionsHandler` as a provider)
- Test: `services/api/src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.spec.ts`

**Interfaces:**
- Consumes: `IScoringRubricRepository.findActiveRubric` / `findRubricVersion` / `findRubricHistory` from Task 3; `RubricDto` (with `version`/`passThreshold`) from Task 4.
- Produces: `GetScoringRubricsQuery(programId, stage?, version?)`; `GetScoringRubricsHandler.execute(query): Promise<ScoringRubricsResponseDto>`; `resolveProgramId(programRepo, programId)` (exported helper, slug-or-uuid resolution shared by both handlers in this task); `GetScoringRubricVersionsQuery(programId, stage)`; `GetScoringRubricVersionsHandler.execute(query): Promise<RubricVersionSummaryDto[]>`; `RubricVersionSummaryDto { version: number; isActive: boolean; createdAt: string; createdByName: string | null; hasSubmittedReviews: boolean }`. Consumed by Task 6 (controller) and — for `RubricVersionSummaryDto` and the version-history endpoint — by Part B's Task 14 (Rubric page warns before saving over a version with submitted reviews).

**Scope note (added after initial planning):** the spec requires the Rubric page to warn a SuperAdmin before saving when submitted reviews already exist against the active version. That flag is `hasSubmittedReviews` below, computed with a single grouped `applicationReview.groupBy` query (not one query per version) so the version-history endpoint stays O(1) round trips regardless of how many versions or reviews exist.

- [ ] **Step 1: Write the failing test**

```ts
// services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { GetScoringRubricsHandler } from './get-scoring-rubrics.handler';
import { GetScoringRubricsQuery } from '../get-scoring-rubrics.query';

const programId = 'prog-uuid-1';

function makeSchema(stage: ScoringStage, version: number) {
  return {
    id: `schema-${stage}-v${version}`,
    programId,
    stage,
    name: `${stage} Rubric`,
    description: null,
    isActive: true,
    version,
    createdById: null,
    passThreshold: new Prisma.Decimal(75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [],
  };
}

describe('GetScoringRubricsHandler', () => {
  let handler: GetScoringRubricsHandler;
  let mockRepo: {
    findActiveRubric: jest.Mock;
    findRubricVersion: jest.Mock;
  };
  let mockProgramRepo: { findBySlug: jest.Mock };

  beforeEach(() => {
    mockRepo = {
      findActiveRubric: jest.fn(),
      findRubricVersion: jest.fn(),
    };
    mockProgramRepo = { findBySlug: jest.fn() };
    handler = new GetScoringRubricsHandler(mockRepo as any, mockProgramRepo as any);
  });

  it('fetches the active rubric for both stages when neither stage nor version is given', async () => {
    mockRepo.findActiveRubric.mockImplementation((_pid, stage) =>
      Promise.resolve(makeSchema(stage, 1)),
    );

    const result = await handler.execute(new GetScoringRubricsQuery(programId));

    expect(mockRepo.findActiveRubric).toHaveBeenCalledWith(programId, ScoringStage.application);
    expect(mockRepo.findActiveRubric).toHaveBeenCalledWith(programId, ScoringStage.interview);
    expect(result.application?.version).toBe(1);
    expect(result.interview?.version).toBe(1);
  });

  it('fetches only the active rubric for the requested stage, leaving the other null', async () => {
    mockRepo.findActiveRubric.mockResolvedValue(makeSchema(ScoringStage.application, 3));

    const result = await handler.execute(new GetScoringRubricsQuery(programId, ScoringStage.application));

    expect(mockRepo.findActiveRubric).toHaveBeenCalledWith(programId, ScoringStage.application);
    expect(mockRepo.findActiveRubric).not.toHaveBeenCalledWith(programId, ScoringStage.interview);
    expect(result.application?.version).toBe(3);
    expect(result.interview).toBeNull();
  });

  it('fetches a specific version via findRubricVersion when stage and version are both given', async () => {
    mockRepo.findRubricVersion.mockResolvedValue(makeSchema(ScoringStage.application, 2));

    const result = await handler.execute(new GetScoringRubricsQuery(programId, ScoringStage.application, 2));

    expect(mockRepo.findRubricVersion).toHaveBeenCalledWith(programId, ScoringStage.application, 2);
    expect(mockRepo.findActiveRubric).not.toHaveBeenCalled();
    expect(result.application?.version).toBe(2);
    expect(result.interview).toBeNull();
  });

  it('throws NotFoundException when the requested version does not exist', async () => {
    mockRepo.findRubricVersion.mockResolvedValue(null);

    await expect(
      handler.execute(new GetScoringRubricsQuery(programId, ScoringStage.application, 99)),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolves a slug programId through IProgramRepository.findBySlug before querying rubrics', async () => {
    mockProgramRepo.findBySlug.mockResolvedValue({ id: 'resolved-uuid' });
    mockRepo.findActiveRubric.mockResolvedValue(null);

    await handler.execute(new GetScoringRubricsQuery('my-program-slug', ScoringStage.application));

    expect(mockProgramRepo.findBySlug).toHaveBeenCalledWith('my-program-slug');
    expect(mockRepo.findActiveRubric).toHaveBeenCalledWith('resolved-uuid', ScoringStage.application);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts` (from `services/api`). Expected: FAIL — `mockRepo.findActiveRubric` is never called because the handler still calls `repo.findRubricsByProgramId`, which does not exist on `mockRepo`, and `GetScoringRubricsQuery` does not accept a third `version` argument yet.

- [ ] **Step 3: Update the query**

```ts
// services/api/src/modules/programs/application/queries/get-scoring-rubrics.query.ts
import { ScoringStage } from '@prisma/client';

/**
 * Get Scoring Rubrics Query
 *
 * Application Layer - Query
 */
export class GetScoringRubricsQuery {
  constructor(
    public readonly programId: string,
    public readonly stage?: ScoringStage,
    public readonly version?: number,
  ) {}
}
```

- [ ] **Step 4: Rewrite the handler**

```ts
// services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { IScoringRubricRepository, ScoringSchemaWithNested } from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { IProgramRepository } from '../../../../../core/interfaces/repositories/program.repository.interface';
import { GetScoringRubricsQuery } from '../get-scoring-rubrics.query';
import {
  ScoringRubricsResponseDto,
  RubricDto,
  RubricCategoryDto,
  RubricCriterionDto,
} from '../../../presentation/dto/scoring-rubric.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolves an admin route param that may be a program slug or a UUID into the program's UUID. */
export async function resolveProgramId(
  programRepo: IProgramRepository,
  programIdOrSlug: string,
): Promise<string> {
  if (UUID_REGEX.test(programIdOrSlug)) return programIdOrSlug;
  const found = await programRepo.findBySlug(programIdOrSlug);
  return found?.id ?? programIdOrSlug;
}

function toNumber(value: Prisma.Decimal | number): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

export function mapSchema(schema: ScoringSchemaWithNested): RubricDto {
  const categories: RubricCategoryDto[] = schema.categories.map((cat) => {
    const criteria: RubricCriterionDto[] = cat.criteria.map((crit) => ({
      id: crit.id,
      name: crit.name,
      description: crit.description,
      weight: toNumber(crit.weight),
      maxScore: toNumber(crit.maxScore),
      order: crit.order,
    }));
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      weight: toNumber(cat.weight),
      order: cat.order,
      criteria,
    };
  });
  return {
    id: schema.id,
    programId: schema.programId,
    stage: schema.stage,
    name: schema.name,
    description: schema.description,
    isActive: schema.isActive,
    version: schema.version,
    passThreshold: toNumber(schema.passThreshold),
    categories,
  };
}

@Injectable()
export class GetScoringRubricsHandler {
  constructor(
    @Inject('IScoringRubricRepository')
    private readonly repo: IScoringRubricRepository,
    @Inject('IProgramRepository')
    private readonly programRepo: IProgramRepository,
  ) {}

  async execute(query: GetScoringRubricsQuery): Promise<ScoringRubricsResponseDto> {
    const programId = await resolveProgramId(this.programRepo, query.programId);

    // A specific version only ever applies to a single, explicitly requested stage.
    if (query.stage && query.version !== undefined) {
      const schema = await this.repo.findRubricVersion(programId, query.stage, query.version);
      if (!schema) {
        throw new NotFoundException(
          `No rubric version ${query.version} found for stage "${query.stage}".`,
        );
      }
      const dto = mapSchema(schema);
      return {
        application: query.stage === ScoringStage.application ? dto : null,
        interview: query.stage === ScoringStage.interview ? dto : null,
      };
    }

    if (query.stage) {
      const schema = await this.repo.findActiveRubric(programId, query.stage);
      const dto = schema ? mapSchema(schema) : null;
      return {
        application: query.stage === ScoringStage.application ? dto : null,
        interview: query.stage === ScoringStage.interview ? dto : null,
      };
    }

    const [application, interview] = await Promise.all([
      this.repo.findActiveRubric(programId, ScoringStage.application),
      this.repo.findActiveRubric(programId, ScoringStage.interview),
    ]);

    return {
      application: application ? mapSchema(application) : null,
      interview: interview ? mapSchema(interview) : null,
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts` (from `services/api`). Expected: PASS, all 5 tests green.

- [ ] **Step 6: Write the failing test for the version-history handler**

```ts
// services/api/src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.spec.ts
import { Prisma, ScoringStage } from '@prisma/client';
import { GetScoringRubricVersionsHandler } from './get-scoring-rubric-versions.handler';
import { GetScoringRubricVersionsQuery } from '../get-scoring-rubric-versions.query';

const programId = 'prog-uuid-1';

function makeVersion(overrides: {
  id: string;
  version: number;
  isActive: boolean;
  createdById: string | null;
}) {
  return {
    ...overrides,
    programId,
    stage: ScoringStage.application,
    name: 'Application Rubric',
    description: null,
    passThreshold: new Prisma.Decimal(75),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    deletedAt: null,
    legacyId: null,
    categories: [],
  };
}

describe('GetScoringRubricVersionsHandler', () => {
  let handler: GetScoringRubricVersionsHandler;
  let mockRepo: { findRubricHistory: jest.Mock };
  let mockProgramRepo: { findBySlug: jest.Mock };
  let mockPrisma: {
    admin: { findMany: jest.Mock };
    applicationReview: { groupBy: jest.Mock };
  };

  beforeEach(() => {
    mockRepo = { findRubricHistory: jest.fn() };
    mockProgramRepo = { findBySlug: jest.fn() };
    mockPrisma = {
      admin: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1', fullName: 'Alice Admin' }]) },
      applicationReview: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    handler = new GetScoringRubricVersionsHandler(mockRepo as any, mockProgramRepo as any, mockPrisma as any);
  });

  it('marks a version true for hasSubmittedReviews when a submitted review exists against its schema id', async () => {
    const v2 = makeVersion({ id: 'schema-v2', version: 2, isActive: true, createdById: 'admin-1' });
    const v1 = makeVersion({ id: 'schema-v1', version: 1, isActive: false, createdById: 'admin-1' });
    mockRepo.findRubricHistory.mockResolvedValue([v2, v1]);
    mockPrisma.applicationReview.groupBy.mockResolvedValue([
      { schemaId: 'schema-v1', _count: { _all: 1 } },
    ]);

    const result = await handler.execute(new GetScoringRubricVersionsQuery(programId, ScoringStage.application));

    expect(mockPrisma.applicationReview.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['schemaId'],
        where: { schemaId: { in: ['schema-v2', 'schema-v1'] }, status: 'submitted' },
      }),
    );

    const byVersion = Object.fromEntries(result.map((r) => [r.version, r]));
    expect(byVersion[1].hasSubmittedReviews).toBe(true);
    expect(byVersion[2].hasSubmittedReviews).toBe(false);
  });

  it('leaves hasSubmittedReviews false for a version with only a draft review, since groupBy filters status=submitted', async () => {
    const v1 = makeVersion({ id: 'schema-v1', version: 1, isActive: true, createdById: 'admin-1' });
    mockRepo.findRubricHistory.mockResolvedValue([v1]);
    // A draft-only review never satisfies the where: { status: 'submitted' } filter,
    // so groupBy legitimately returns no row for schema-v1 here.
    mockPrisma.applicationReview.groupBy.mockResolvedValue([]);

    const result = await handler.execute(new GetScoringRubricVersionsQuery(programId, ScoringStage.application));

    expect(result[0].hasSubmittedReviews).toBe(false);
  });

  it('resolves createdByName from the admins table and returns null when createdById is null', async () => {
    const v1 = makeVersion({ id: 'schema-v1', version: 1, isActive: true, createdById: null });
    mockRepo.findRubricHistory.mockResolvedValue([v1]);

    const result = await handler.execute(new GetScoringRubricVersionsQuery(programId, ScoringStage.application));

    expect(mockPrisma.admin.findMany).not.toHaveBeenCalled();
    expect(result[0].createdByName).toBeNull();
  });

  it('returns versions newest-first, matching findRubricHistory ordering', async () => {
    const v2 = makeVersion({ id: 'schema-v2', version: 2, isActive: true, createdById: null });
    const v1 = makeVersion({ id: 'schema-v1', version: 1, isActive: false, createdById: null });
    mockRepo.findRubricHistory.mockResolvedValue([v2, v1]);

    const result = await handler.execute(new GetScoringRubricVersionsQuery(programId, ScoringStage.application));

    expect(result.map((r) => r.version)).toEqual([2, 1]);
  });

  it('resolves a slug programId through IProgramRepository.findBySlug before querying history', async () => {
    mockProgramRepo.findBySlug.mockResolvedValue({ id: 'resolved-uuid' });
    mockRepo.findRubricHistory.mockResolvedValue([]);

    await handler.execute(new GetScoringRubricVersionsQuery('my-program-slug', ScoringStage.application));

    expect(mockProgramRepo.findBySlug).toHaveBeenCalledWith('my-program-slug');
    expect(mockRepo.findRubricHistory).toHaveBeenCalledWith('resolved-uuid', ScoringStage.application);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.spec.ts` (from `services/api`). Expected: FAIL with `Cannot find module './get-scoring-rubric-versions.handler'`.

- [ ] **Step 8: Add `RubricVersionSummaryDto`**

```ts
// services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts (append at end of file)
export class RubricVersionSummaryDto {
  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ nullable: true })
  createdByName!: string | null;

  @ApiProperty({ description: 'True if any submitted ApplicationReview is pinned to this version.' })
  hasSubmittedReviews!: boolean;
}
```

- [ ] **Step 9: Write the query and handler**

```ts
// services/api/src/modules/programs/application/queries/get-scoring-rubric-versions.query.ts
import { ScoringStage } from '@prisma/client';

export class GetScoringRubricVersionsQuery {
  constructor(
    public readonly programId: string,
    public readonly stage: ScoringStage,
  ) {}
}
```

```ts
// services/api/src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.ts
import { Injectable, Inject } from '@nestjs/common';
import { IScoringRubricRepository } from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { IProgramRepository } from '../../../../../core/interfaces/repositories/program.repository.interface';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetScoringRubricVersionsQuery } from '../get-scoring-rubric-versions.query';
import { RubricVersionSummaryDto } from '../../../presentation/dto/scoring-rubric.dto';
import { resolveProgramId } from './get-scoring-rubrics.handler';

@Injectable()
export class GetScoringRubricVersionsHandler {
  constructor(
    @Inject('IScoringRubricRepository')
    private readonly repo: IScoringRubricRepository,
    @Inject('IProgramRepository')
    private readonly programRepo: IProgramRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetScoringRubricVersionsQuery): Promise<RubricVersionSummaryDto[]> {
    const programId = await resolveProgramId(this.programRepo, query.programId);
    const versions = await this.repo.findRubricHistory(programId, query.stage);

    if (versions.length === 0) return [];

    const schemaIds = versions.map((v) => v.id);
    const createdByIds = [
      ...new Set(versions.map((v) => v.createdById).filter((id): id is string => id !== null)),
    ];

    // One grouped count over ApplicationReview for the whole version list, not one query per version.
    const [admins, submittedCounts] = await Promise.all([
      createdByIds.length > 0
        ? this.prisma.admin.findMany({
            where: { id: { in: createdByIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
      this.prisma.applicationReview.groupBy({
        by: ['schemaId'],
        where: { schemaId: { in: schemaIds }, status: 'submitted' },
        _count: { _all: true },
      }),
    ]);

    const nameById = new Map(admins.map((a) => [a.id, a.fullName]));
    const submittedSchemaIds = new Set(
      submittedCounts.filter((c) => c._count._all > 0).map((c) => c.schemaId),
    );

    return versions.map((v) => ({
      version: v.version,
      isActive: v.isActive,
      createdAt: v.createdAt.toISOString(),
      createdByName: v.createdById ? nameById.get(v.createdById) ?? null : null,
      hasSubmittedReviews: submittedSchemaIds.has(v.id),
    }));
  }
}
```

- [ ] **Step 10: Register the handler in the module**

```ts
// services/api/src/modules/programs/programs.module.ts
// Add to the query-handler imports and the `providers` array, alongside GetScoringRubricsHandler:
import { GetScoringRubricVersionsHandler } from './application/queries/handlers/get-scoring-rubric-versions.handler';
// ...
providers: [
  // ...
  GetScoringRubricsHandler,
  GetScoringRubricVersionsHandler,
  UpsertScoringRubricHandler,
  // ...
],
```

- [ ] **Step 11: Run test to verify it passes**

Run: `npm test -- src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.spec.ts` (from `services/api`). Expected: PASS, all 5 tests green, including the two the coordinator specifically asked for: `hasSubmittedReviews` true for a version with a submitted review, false for one with only a draft review.

- [ ] **Step 12: Commit**

```bash
git add services/api/src/modules/programs/application/queries/get-scoring-rubrics.query.ts services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.ts services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts services/api/src/modules/programs/application/queries/get-scoring-rubric-versions.query.ts services/api/src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.ts services/api/src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.spec.ts services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts services/api/src/modules/programs/programs.module.ts
git commit -m "feat: support fetching a specific scoring rubric version and per-version submitted-review usage"
```

---

### Task 6: Program scoring controller version and history endpoints

**Files:**
- Modify: `services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts:80-97` (`UpsertScoringRubricDto` gains `passThreshold`)
- Modify: `services/api/src/modules/programs/presentation/program-scoring.controller.ts` (full rewrite)
- Test: `services/api/src/modules/programs/presentation/program-scoring.controller.spec.ts` (full rewrite)

**Interfaces:**
- Consumes: `GetScoringRubricsQuery(programId, stage?, version?)`, `GetScoringRubricsHandler` from Task 5; `GetScoringRubricVersionsQuery(programId, stage)`, `GetScoringRubricVersionsHandler`, `RubricVersionSummaryDto` from Task 5; `UpsertScoringRubricCommand(programId, stage, payload, createdById)`, `UpsertScoringRubricHandler` from Task 4.
- Produces: `GET /programs/:programId/scoring-rubrics?stage=&version=` (reads one full past version — this is what Part B's `getScoringRubricVersion(programId, stage, version)` api-client call hits), `PUT /programs/:programId/scoring-rubrics/:stage`, `GET /programs/:programId/scoring-rubrics/versions?stage=` returning `RubricVersionSummaryDto[]` (this is what Part B's `getScoringRubricVersion**s**(programId, stage)` api-client call hits, feeding Part B's Task 14 pre-save warning). The `/versions` route is mandated by the coordinator's scope addition and is not part of the Shared Interface Contract's originally-frozen list, but its name and shape are now fixed for Part B — do not rename `RubricVersionSummaryDto`'s fields or the route.

**Scope note (added after initial planning):** the version-history route changed from an earlier draft (`/scoring-rubrics/:stage/history`, returning full `RubricDto[]`) to the coordinator-mandated `/scoring-rubrics/versions?stage=`, returning the lighter `RubricVersionSummaryDto[]` with `hasSubmittedReviews` per version. The controller no longer injects `IScoringRubricRepository`/`IProgramRepository` directly — that logic now lives in `GetScoringRubricVersionsHandler` (Task 5), keeping the controller a thin CQRS dispatcher consistent with `getScoringRubrics`/`upsertScoringRubric`.

- [ ] **Step 1: Write the failing test**

```ts
// services/api/src/modules/programs/presentation/program-scoring.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ScoringStage } from '@prisma/client';
import { ProgramScoringController } from './program-scoring.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { GetScoringRubricsHandler } from '../application/queries/handlers/get-scoring-rubrics.handler';
import { GetScoringRubricVersionsHandler } from '../application/queries/handlers/get-scoring-rubric-versions.handler';
import { UpsertScoringRubricHandler } from '../application/commands/handlers/upsert-scoring-rubric.handler';
import { GetScoringRubricsQuery } from '../application/queries/get-scoring-rubrics.query';
import { GetScoringRubricVersionsQuery } from '../application/queries/get-scoring-rubric-versions.query';
import { UpsertScoringRubricCommand } from '../application/commands/upsert-scoring-rubric.command';
import { UpsertScoringRubricDto } from './dto/scoring-rubric.dto';

describe('ProgramScoringController', () => {
  let controller: ProgramScoringController;
  const mockHandlerExecute = { execute: jest.fn() };
  const mockVersionsHandlerExecute = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramScoringController],
      providers: [
        { provide: GetScoringRubricsHandler, useValue: mockHandlerExecute },
        { provide: UpsertScoringRubricHandler, useValue: mockHandlerExecute },
        { provide: GetScoringRubricVersionsHandler, useValue: mockVersionsHandlerExecute },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProgramScoringController>(ProgramScoringController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getScoringRubrics', () => {
    it('executes GetScoringRubricsQuery with programId, stage, and no version by default', async () => {
      mockHandlerExecute.execute.mockResolvedValue({ application: null, interview: null });
      await controller.getScoringRubrics('prog-1', undefined, undefined);
      const query: GetScoringRubricsQuery = mockHandlerExecute.execute.mock.calls[0][0];
      expect(query.programId).toBe('prog-1');
      expect(query.stage).toBeUndefined();
      expect(query.version).toBeUndefined();
    });

    it('passes stage and version query params when provided', async () => {
      mockHandlerExecute.execute.mockResolvedValue({ application: null, interview: null });
      await controller.getScoringRubrics('prog-1', ScoringStage.application, '2');
      const query: GetScoringRubricsQuery = mockHandlerExecute.execute.mock.calls[0][0];
      expect(query.stage).toBe(ScoringStage.application);
      expect(query.version).toBe(2);
    });

    it('rejects a non-numeric version with 400', async () => {
      await expect(
        controller.getScoringRubrics('prog-1', ScoringStage.application, 'not-a-number'),
      ).rejects.toThrow('version must be a positive integer.');
    });
  });

  describe('upsertScoringRubric', () => {
    it('executes UpsertScoringRubricCommand with the current admin as createdById', async () => {
      mockHandlerExecute.execute.mockResolvedValue({ id: 'schema-1' });
      const dto = plainToInstance(UpsertScoringRubricDto, {
        name: 'App Rubric',
        passThreshold: 75,
        categories: [
          { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
        ],
      });

      await controller.upsertScoringRubric('prog-1', 'application', dto, { userId: 'admin-1' } as never);

      const cmd: UpsertScoringRubricCommand = mockHandlerExecute.execute.mock.calls[0][0];
      expect(cmd.programId).toBe('prog-1');
      expect(cmd.stage).toBe(ScoringStage.application);
      expect(cmd.createdById).toBe('admin-1');
      expect(cmd.payload.passThreshold).toBe(75);
    });

    it('rejects an invalid stage param with 400', async () => {
      const dto = plainToInstance(UpsertScoringRubricDto, { categories: [] });
      await expect(
        controller.upsertScoringRubric('prog-1', 'not-a-stage', dto, { userId: 'admin-1' } as never),
      ).rejects.toThrow('Invalid stage "not-a-stage"');
    });
  });

  describe('getScoringRubricVersions', () => {
    it('executes GetScoringRubricVersionsQuery with programId and stage, and returns its result unchanged', async () => {
      const summaries = [
        { version: 2, isActive: true, createdAt: '2026-08-01T00:00:00.000Z', createdByName: 'Alice', hasSubmittedReviews: false },
        { version: 1, isActive: false, createdAt: '2026-07-01T00:00:00.000Z', createdByName: 'Alice', hasSubmittedReviews: true },
      ];
      mockVersionsHandlerExecute.execute.mockResolvedValue(summaries);

      const result = await controller.getScoringRubricVersions('prog-1', ScoringStage.application);

      expect(mockVersionsHandlerExecute.execute).toHaveBeenCalledWith(expect.any(GetScoringRubricVersionsQuery));
      const query: GetScoringRubricVersionsQuery = mockVersionsHandlerExecute.execute.mock.calls[0][0];
      expect(query.programId).toBe('prog-1');
      expect(query.stage).toBe(ScoringStage.application);
      expect(result).toEqual(summaries);
    });
  });
});

describe('UpsertScoringRubricDto: weight/maxScore validation via controller DTO', () => {
  it('converts percentage weight to fraction before validation', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, {
      categories: [
        { name: 'Essay', weight: -0.01, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/programs/presentation/program-scoring.controller.spec.ts` (from `services/api`). Expected: FAIL — `controller.getScoringRubricVersions is not a function`, and `getScoringRubrics`/`upsertScoringRubric` reject the extra arguments because the controller signatures don't accept them yet.

- [ ] **Step 3: Add `passThreshold` to `UpsertScoringRubricDto`**

```ts
// services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts:80-97
export class UpsertScoringRubricDto {
  @ApiPropertyOptional({ description: 'Human-readable rubric name.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Pass/fail cutoff for this stage, 0-100.', default: 75 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  passThreshold?: number;

  @ApiProperty({ type: () => UpsertCategoryDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCategoryDto)
  categories!: UpsertCategoryDto[];
}
```

- [ ] **Step 4: Rewrite the controller**

```ts
// services/api/src/modules/programs/presentation/program-scoring.controller.ts
import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScoringStage } from '@prisma/client';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { UserRole } from '@core/entities/user.entity';
import { GetScoringRubricsHandler } from '../application/queries/handlers/get-scoring-rubrics.handler';
import { GetScoringRubricVersionsHandler } from '../application/queries/handlers/get-scoring-rubric-versions.handler';
import { UpsertScoringRubricHandler } from '../application/commands/handlers/upsert-scoring-rubric.handler';
import { GetScoringRubricsQuery } from '../application/queries/get-scoring-rubrics.query';
import { GetScoringRubricVersionsQuery } from '../application/queries/get-scoring-rubric-versions.query';
import { UpsertScoringRubricCommand } from '../application/commands/upsert-scoring-rubric.command';
import {
  UpsertScoringRubricDto,
  ScoringRubricsResponseDto,
  RubricDto,
  RubricVersionSummaryDto,
} from './dto/scoring-rubric.dto';

@ApiTags('Scoring Rubrics')
@Controller('programs')
export class ProgramScoringController {
  constructor(
    private readonly getScoringRubricsHandler: GetScoringRubricsHandler,
    private readonly getScoringRubricVersionsHandler: GetScoringRubricVersionsHandler,
    private readonly upsertScoringRubricHandler: UpsertScoringRubricHandler,
  ) {}

  private parseVersion(raw?: string): number | undefined {
    if (raw === undefined) return undefined;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException('version must be a positive integer.');
    }
    return parsed;
  }

  private parseStage(stageParam: string): ScoringStage {
    if (stageParam !== ScoringStage.application && stageParam !== ScoringStage.interview) {
      throw new BadRequestException(`Invalid stage "${stageParam}". Must be "application" or "interview".`);
    }
    return stageParam;
  }

  @Get(':programId/scoring-rubrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get scoring rubrics for a program (application and interview stages)' })
  async getScoringRubrics(
    @Param('programId') programId: string,
    @Query('stage', new ParseEnumPipe(ScoringStage, { optional: true })) stage?: ScoringStage,
    @Query('version') versionRaw?: string,
  ): Promise<ScoringRubricsResponseDto> {
    const version = this.parseVersion(versionRaw);
    return this.getScoringRubricsHandler.execute(new GetScoringRubricsQuery(programId, stage, version));
  }

  @Get(':programId/scoring-rubrics/versions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List every version of a program/stage rubric, newest first, flagging versions with submitted reviews' })
  async getScoringRubricVersions(
    @Param('programId') programId: string,
    @Query('stage', new ParseEnumPipe(ScoringStage)) stage: ScoringStage,
  ): Promise<RubricVersionSummaryDto[]> {
    return this.getScoringRubricVersionsHandler.execute(
      new GetScoringRubricVersionsQuery(programId, stage),
    );
  }

  @Put(':programId/scoring-rubrics/:stage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mint a new rubric version for a stage (super admin only)' })
  async upsertScoringRubric(
    @Param('programId') programId: string,
    @Param('stage') stageParam: string,
    @Body() dto: UpsertScoringRubricDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<RubricDto> {
    const stage = this.parseStage(stageParam);

    // The DTO already validates fractions (0-1 range).
    // The frontend API client is responsible for any percentage-to-fraction conversion.
    return this.upsertScoringRubricHandler.execute(
      new UpsertScoringRubricCommand(
        programId,
        stage,
        {
          name: dto.name,
          description: dto.description,
          passThreshold: dto.passThreshold,
          categories: dto.categories.map((cat) => ({
            name: cat.name,
            description: cat.description,
            weight: cat.weight,
            order: cat.order,
            criteria: cat.criteria.map((crit) => ({
              name: crit.name,
              description: crit.description,
              weight: crit.weight,
              maxScore: crit.maxScore,
              order: crit.order,
            })),
          })),
        },
        user.userId,
      ),
    );
  }
}
```

Note: `UpsertCategoryPayload`/`UpsertCriterionPayload` dropped their optional `id` field in Task 3 (minting always deep-copies fresh rows), so the controller no longer forwards `cat.id`/`crit.id` from the DTO even though `UpsertCategoryDto`/`UpsertCriterionDto` still accept one for backward API compatibility with any in-flight frontend requests; the id is simply ignored server-side now.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/modules/programs/presentation/program-scoring.controller.spec.ts` (from `services/api`). Expected: PASS, all 8 tests green.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts services/api/src/modules/programs/presentation/program-scoring.controller.ts services/api/src/modules/programs/presentation/program-scoring.controller.spec.ts
git commit -m "feat: add rubric version query support and per-version submitted-review history endpoint"
```

---

### Task 7: Get application review query handler

**Files:**
- Create: `services/api/src/modules/applications/application/dto/application-review-response.dto.ts`
- Create: `services/api/src/modules/applications/application/queries/get-application-review.query.ts`
- Create: `services/api/src/modules/applications/application/queries/handlers/get-application-review.handler.ts`
- Test: `services/api/src/modules/applications/application/queries/handlers/get-application-review.handler.spec.ts`

**Interfaces:**
- Consumes: `evaluateInterviewGate`, `GateState` from Task 1 (`@modules/scoring/domain/scoring-calculation`); `IScoringRubricRepository.findActiveRubric`, `ScoringSchemaWithNested` from Task 3; `mapSchema` (exported from Task 5's `@modules/programs/application/queries/handlers/get-scoring-rubrics.handler`); `IApplicationRepository.findById` (existing, `@core/interfaces/repositories/application.repository.interface`); `APPLICATION_REPOSITORY` token (existing, `@modules/applications/infrastructure/tokens`); Prisma's `applicationReview`/`scoringSchema` tables (Task 2's schema).
- Produces: `ApplicationReviewResponseDto { id: string | null; applicationId; stage; schemaId; schemaVersion; status; totalScore; notes; items[]; rubric: RubricDto; gate: GateState; hasNewerRubricVersion }`; `ApplicationScoreItemDto { criterionId; score; notes? }`; `GetApplicationReviewQuery(applicationId, stage)`; `GetApplicationReviewHandler.execute(query): Promise<ApplicationReviewResponseDto>`. Consumed by Task 8 (the upsert handler reuses the same pinned-schema-resolution and gate logic) and by the controller that wires `GET /applications/:applicationId/review?stage=` (Part A's frozen endpoint list; wiring the route itself is out of scope for Tasks 1-8 per the task list — `ApplicationsController` already exists and gets a `review` GET method added when this handler is registered, using the same pattern as the existing `@Post(':id/review')` action).

- [ ] **Step 1: Write the failing test**

```ts
// services/api/src/modules/applications/application/queries/handlers/get-application-review.handler.spec.ts
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { GetApplicationReviewHandler } from './get-application-review.handler';
import { GetApplicationReviewQuery } from '../get-application-review.query';

const applicationId = 'app-uuid-1';
const programId = 'prog-uuid-1';

function makeApplication() {
  return { id: applicationId, programId, participantId: 'participant-1', status: 'submitted' };
}

function makeActiveRubric(overrides: { stage: ScoringStage; version: number; passThreshold?: number }) {
  return {
    id: `schema-${overrides.stage}-v${overrides.version}`,
    programId,
    stage: overrides.stage,
    name: `${overrides.stage} Rubric`,
    description: null,
    isActive: true,
    version: overrides.version,
    createdById: null,
    passThreshold: new Prisma.Decimal(overrides.passThreshold ?? 75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [
      {
        id: 'cat-1',
        schemaId: `schema-${overrides.stage}-v${overrides.version}`,
        name: 'Essay',
        description: null,
        weight: new Prisma.Decimal(1),
        order: 0,
        legacyId: null,
        criteria: [
          {
            id: 'crit-1',
            categoryId: 'cat-1',
            name: 'Relevance',
            description: null,
            weight: new Prisma.Decimal(1),
            maxScore: new Prisma.Decimal(100),
            order: 0,
            legacyId: null,
          },
        ],
      },
    ],
  };
}

describe('GetApplicationReviewHandler', () => {
  let handler: GetApplicationReviewHandler;
  let mockApplicationRepo: { findById: jest.Mock };
  let mockScoringRubricRepo: { findActiveRubric: jest.Mock };
  let mockPrisma: {
    applicationReview: { findUnique: jest.Mock };
    scoringSchema: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    mockApplicationRepo = { findById: jest.fn().mockResolvedValue(makeApplication()) };
    mockScoringRubricRepo = { findActiveRubric: jest.fn() };
    mockPrisma = {
      applicationReview: { findUnique: jest.fn() },
      scoringSchema: { findUnique: jest.fn() },
    };
    handler = new GetApplicationReviewHandler(
      mockApplicationRepo as any,
      mockScoringRubricRepo as any,
      mockPrisma as any,
    );
  });

  it('throws NotFoundException when the application does not exist', async () => {
    mockApplicationRepo.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.application)),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException (409) when no active rubric exists for that program/stage', async () => {
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(null);
    await expect(
      handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.interview)),
    ).rejects.toThrow(ConflictException);
    await expect(
      handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.interview)),
    ).rejects.toThrow(/Rubric page/);
  });

  it('returns an empty review shaped against the active rubric when none exists yet, with the application-stage gate always open', async () => {
    const activeRubric = makeActiveRubric({ stage: ScoringStage.application, version: 1 });
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(activeRubric);
    mockPrisma.applicationReview.findUnique.mockResolvedValue(null);

    const result = await handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.application));

    expect(result.id).toBeNull();
    expect(result.schemaId).toBe(activeRubric.id);
    expect(result.schemaVersion).toBe(1);
    expect(result.status).toBe('draft');
    expect(result.totalScore).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.rubric.categories).toHaveLength(1);
    expect(result.hasNewerRubricVersion).toBe(false);
    expect(result.gate).toEqual({
      isOpen: true,
      reason: 'open',
      applicationTotal: null,
      applicationThreshold: null,
    });
  });

  it('returns an existing review resolved against its pinned schema, flagging a newer active version', async () => {
    const activeRubric = makeActiveRubric({ stage: ScoringStage.application, version: 2 });
    const pinnedSchema = makeActiveRubric({ stage: ScoringStage.application, version: 1 });
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(activeRubric);
    mockPrisma.applicationReview.findUnique.mockResolvedValue({
      id: 'review-1',
      applicationId,
      schemaId: pinnedSchema.id,
      reviewerId: 'admin-1',
      stage: ScoringStage.application,
      totalScore: new Prisma.Decimal(42.5),
      notes: 'Looks good',
      status: 'draft',
      overrideById: null,
      overrideReason: null,
      startedAt: new Date(),
      completedAt: null,
      items: [{ id: 'item-1', reviewId: 'review-1', criterionId: 'crit-1', score: new Prisma.Decimal(85), notes: null, legacyId: null }],
    });
    mockPrisma.scoringSchema.findUnique.mockResolvedValue(pinnedSchema);

    const result = await handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.application));

    expect(result.id).toBe('review-1');
    expect(result.schemaId).toBe(pinnedSchema.id);
    expect(result.schemaVersion).toBe(1);
    expect(result.totalScore).toBe(42.5);
    expect(result.items).toEqual([{ criterionId: 'crit-1', score: 85, notes: null }]);
    expect(result.hasNewerRubricVersion).toBe(true);
  });

  it('interview stage: gate is closed with reason application_draft when the application-stage review is still draft', async () => {
    const interviewRubric = makeActiveRubric({ stage: ScoringStage.interview, version: 1 });
    const applicationRubric = makeActiveRubric({ stage: ScoringStage.application, version: 1, passThreshold: 75 });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? interviewRubric : applicationRubric),
    );
    mockPrisma.applicationReview.findUnique.mockImplementation(({ where }: any) =>
      where.applicationId_stage.stage === ScoringStage.application
        ? Promise.resolve({
            id: 'review-app', applicationId, schemaId: applicationRubric.id, reviewerId: 'admin-1',
            stage: ScoringStage.application, totalScore: new Prisma.Decimal(90), notes: null,
            status: 'draft', overrideById: null, overrideReason: null, startedAt: new Date(),
            completedAt: null, items: [],
          })
        : Promise.resolve(null),
    );

    const result = await handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.interview));

    expect(result.gate).toEqual({
      isOpen: false,
      reason: 'application_draft',
      applicationTotal: 90,
      applicationThreshold: 75,
    });
  });

  it('interview stage: gate is open when the application-stage review is submitted at or above threshold', async () => {
    const interviewRubric = makeActiveRubric({ stage: ScoringStage.interview, version: 1 });
    const applicationRubric = makeActiveRubric({ stage: ScoringStage.application, version: 1, passThreshold: 75 });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? interviewRubric : applicationRubric),
    );
    mockPrisma.applicationReview.findUnique.mockImplementation(({ where }: any) =>
      where.applicationId_stage.stage === ScoringStage.application
        ? Promise.resolve({
            id: 'review-app', applicationId, schemaId: applicationRubric.id, reviewerId: 'admin-1',
            stage: ScoringStage.application, totalScore: new Prisma.Decimal(80), notes: null,
            status: 'submitted', overrideById: null, overrideReason: null, startedAt: new Date(),
            completedAt: new Date(), items: [],
          })
        : Promise.resolve(null),
    );

    const result = await handler.execute(new GetApplicationReviewQuery(applicationId, ScoringStage.interview));

    expect(result.gate).toEqual({
      isOpen: true,
      reason: 'open',
      applicationTotal: 80,
      applicationThreshold: 75,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/applications/application/queries/handlers/get-application-review.handler.spec.ts` (from `services/api`). Expected: FAIL with `Cannot find module './get-application-review.handler'`.

- [ ] **Step 3: Write the response DTO**

```ts
// services/api/src/modules/applications/application/dto/application-review-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScoringStage } from '@prisma/client';
import { RubricDto } from '@modules/programs/presentation/dto/scoring-rubric.dto';
import { GateState } from '@modules/scoring/domain/scoring-calculation';

export class ApplicationScoreItemDto {
  @ApiProperty()
  criterionId!: string;

  @ApiProperty()
  score!: number;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;
}

export class ApplicationReviewResponseDto {
  @ApiPropertyOptional({ nullable: true, description: 'Null until the first draft is saved.' })
  id!: string | null;

  @ApiProperty()
  applicationId!: string;

  @ApiProperty({ enum: ScoringStage })
  stage!: ScoringStage;

  @ApiProperty({ description: 'The schema this review is pinned to (its own version once created, otherwise the current active one).' })
  schemaId!: string;

  @ApiProperty()
  schemaVersion!: number;

  @ApiProperty({ enum: ['draft', 'submitted'] })
  status!: 'draft' | 'submitted';

  @ApiProperty()
  totalScore!: number;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: () => ApplicationScoreItemDto, isArray: true })
  items!: ApplicationScoreItemDto[];

  @ApiProperty({ type: () => RubricDto })
  rubric!: RubricDto;

  @ApiProperty({ description: 'Whether this stage is scoreable right now, and why.' })
  gate!: GateState;

  @ApiProperty()
  hasNewerRubricVersion!: boolean;
}
```

- [ ] **Step 4: Write the query**

```ts
// services/api/src/modules/applications/application/queries/get-application-review.query.ts
import { ScoringStage } from '@prisma/client';

export class GetApplicationReviewQuery {
  constructor(
    public readonly applicationId: string,
    public readonly stage: ScoringStage,
  ) {}
}
```

- [ ] **Step 5: Write the handler**

```ts
// services/api/src/modules/applications/application/queries/handlers/get-application-review.handler.ts
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
} from '@core/interfaces/repositories/scoring-rubric.repository.interface';
import { mapSchema } from '@modules/programs/application/queries/handlers/get-scoring-rubrics.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { evaluateInterviewGate, GateState } from '@modules/scoring/domain/scoring-calculation';
import { GetApplicationReviewQuery } from '../get-application-review.query';
import {
  ApplicationReviewResponseDto,
  ApplicationScoreItemDto,
} from '../../dto/application-review-response.dto';

function toNumber(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

const SCHEMA_CATEGORIES_INCLUDE = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: { criteria: { orderBy: { order: 'asc' as const } } },
  },
};

@Injectable()
export class GetApplicationReviewHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    @Inject('IScoringRubricRepository')
    private readonly scoringRubricRepo: IScoringRubricRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetApplicationReviewQuery): Promise<ApplicationReviewResponseDto> {
    const application = await this.applicationRepository.findById(query.applicationId);
    if (!application) {
      throw new NotFoundException(`Application ${query.applicationId} not found`);
    }

    const activeRubric = await this.scoringRubricRepo.findActiveRubric(application.programId, query.stage);
    if (!activeRubric) {
      throw new ConflictException(
        `No active "${query.stage}" scoring rubric exists for this program yet. Ask a SuperAdmin to author one on the Rubric page before scoring.`,
      );
    }

    const gate = await this.resolveGate(application.programId, application.id, query.stage);

    const existingReview = await this.prisma.applicationReview.findUnique({
      where: { applicationId_stage: { applicationId: query.applicationId, stage: query.stage } },
      include: { items: true },
    });

    if (!existingReview) {
      return {
        id: null,
        applicationId: query.applicationId,
        stage: query.stage,
        schemaId: activeRubric.id,
        schemaVersion: activeRubric.version,
        status: 'draft',
        totalScore: 0,
        notes: null,
        items: [],
        rubric: mapSchema(activeRubric),
        gate,
        hasNewerRubricVersion: false,
      };
    }

    const pinnedSchema = (await this.prisma.scoringSchema.findUnique({
      where: { id: existingReview.schemaId },
      include: SCHEMA_CATEGORIES_INCLUDE,
    })) as ScoringSchemaWithNested | null;

    if (!pinnedSchema) {
      throw new NotFoundException(`Pinned scoring schema ${existingReview.schemaId} not found`);
    }

    const items: ApplicationScoreItemDto[] = existingReview.items.map((item) => ({
      criterionId: item.criterionId,
      score: toNumber(item.score),
      notes: item.notes,
    }));

    return {
      id: existingReview.id,
      applicationId: query.applicationId,
      stage: query.stage,
      schemaId: pinnedSchema.id,
      schemaVersion: pinnedSchema.version,
      status: existingReview.status,
      totalScore: toNumber(existingReview.totalScore),
      notes: existingReview.notes,
      items,
      rubric: mapSchema(pinnedSchema),
      gate,
      hasNewerRubricVersion: pinnedSchema.version < activeRubric.version,
    };
  }

  /** The application stage has nothing gating it. Only the interview stage checks the application stage's outcome. */
  private async resolveGate(
    programId: string,
    applicationId: string,
    stage: ScoringStage,
  ): Promise<GateState> {
    if (stage === ScoringStage.application) {
      return { isOpen: true, reason: 'open', applicationTotal: null, applicationThreshold: null };
    }

    const [applicationStageReview, applicationRubric] = await Promise.all([
      this.prisma.applicationReview.findUnique({
        where: { applicationId_stage: { applicationId, stage: ScoringStage.application } },
      }),
      this.scoringRubricRepo.findActiveRubric(programId, ScoringStage.application),
    ]);

    const threshold = applicationRubric ? toNumber(applicationRubric.passThreshold) : 75;

    return evaluateInterviewGate(
      applicationStageReview
        ? { status: applicationStageReview.status, totalScore: toNumber(applicationStageReview.totalScore) }
        : null,
      threshold,
    );
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/modules/applications/application/queries/handlers/get-application-review.handler.spec.ts` (from `services/api`). Expected: PASS, all 6 tests green.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/modules/applications/application/dto/application-review-response.dto.ts services/api/src/modules/applications/application/queries/get-application-review.query.ts services/api/src/modules/applications/application/queries/handlers/get-application-review.handler.ts services/api/src/modules/applications/application/queries/handlers/get-application-review.handler.spec.ts
git commit -m "feat: add get application review query handler with stage gating"
```

---

### Task 8: Upsert application review command handler

**Files:**
- Create: `services/api/src/modules/applications/application/commands/upsert-application-review.command.ts`
- Create: `services/api/src/modules/applications/application/commands/handlers/upsert-application-review.handler.ts`
- Test: `services/api/src/modules/applications/application/commands/handlers/upsert-application-review.handler.spec.ts`

**Interfaces:**
- Consumes: `calculateWeightedTotal`, `resolveStageOutcome`, `evaluateInterviewGate`, `WeightValidationError`, `WeightedCategory` from Task 1; `IScoringRubricRepository.findActiveRubric`, `ScoringSchemaWithNested` from Task 3; `IApplicationRepository.findById`, `APPLICATION_REPOSITORY` (existing); `GetApplicationReviewHandler`, `GetApplicationReviewQuery`, `ApplicationReviewResponseDto` from Task 7 (this handler delegates response-building to Task 7's handler after its own transaction commits, so both endpoints always render a review identically); `UserRole` (existing, `@core/entities/user.entity`).
- Produces: `UpsertApplicationReviewDto { status: 'draft' | 'submitted'; notes?: string; items: { criterionId: string; score: number; notes?: string }[]; overrideReason?: string }` (plain application-layer payload type — the class-validator presentation DTO and the controller route that wires `PUT /applications/:applicationId/review?stage=` are out of scope for Tasks 1-8, same carve-out noted in Task 7); `UpsertApplicationReviewCommand(applicationId, stage, actingAdminId, actingAdminRole, payload)`; `UpsertApplicationReviewHandler.execute(command): Promise<ApplicationReviewResponseDto>`.

- [ ] **Step 1: Write the failing test**

```ts
// services/api/src/modules/applications/application/commands/handlers/upsert-application-review.handler.spec.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { UserRole } from '@core/entities/user.entity';
import { UpsertApplicationReviewHandler } from './upsert-application-review.handler';
import { UpsertApplicationReviewCommand } from '../upsert-application-review.command';

const applicationId = 'app-uuid-1';
const programId = 'prog-uuid-1';

function makeApplication() {
  return { id: applicationId, programId, participantId: 'participant-1', status: 'submitted' };
}

// Achievement 40%, Essay 60%; single criterion each, weight 1.0, maxScore 100 — mirrors the
// legacy-derived seed shape closely enough to exercise the real weighted-total formula.
function makeRubric(stage: ScoringStage, overrides?: { version?: number; passThreshold?: number; maxScore?: number }) {
  const version = overrides?.version ?? 1;
  return {
    id: `schema-${stage}-v${version}`,
    programId,
    stage,
    name: `${stage} Rubric`,
    description: null,
    isActive: true,
    version,
    createdById: null,
    passThreshold: new Prisma.Decimal(overrides?.passThreshold ?? 75),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [
      {
        id: 'cat-achievement', schemaId: `schema-${stage}-v${version}`, name: 'Achievement', description: null,
        weight: new Prisma.Decimal(0.4), order: 0, legacyId: null,
        criteria: [
          { id: 'crit-leadership', categoryId: 'cat-achievement', name: 'Leadership', description: null, weight: new Prisma.Decimal(1), maxScore: new Prisma.Decimal(overrides?.maxScore ?? 100), order: 0, legacyId: null },
        ],
      },
      {
        id: 'cat-essay', schemaId: `schema-${stage}-v${version}`, name: 'Essay', description: null,
        weight: new Prisma.Decimal(0.6), order: 1, legacyId: null,
        criteria: [
          { id: 'crit-relevance', categoryId: 'cat-essay', name: 'Relevance', description: null, weight: new Prisma.Decimal(1), maxScore: new Prisma.Decimal(overrides?.maxScore ?? 100), order: 0, legacyId: null },
        ],
      },
    ],
  };
}

describe('UpsertApplicationReviewHandler', () => {
  let handler: UpsertApplicationReviewHandler;
  let mockApplicationRepo: { findById: jest.Mock };
  let mockScoringRubricRepo: { findActiveRubric: jest.Mock };
  let mockGetApplicationReviewHandler: { execute: jest.Mock };
  let mockTx: {
    applicationReview: { upsert: jest.Mock; findUnique: jest.Mock };
    applicationScoreItem: { deleteMany: jest.Mock; createMany: jest.Mock };
    participantApplication: { update: jest.Mock };
  };
  let mockPrisma: {
    applicationReview: { findUnique: jest.Mock };
    scoringSchema: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  const validPayload = {
    status: 'submitted' as const,
    items: [
      { criterionId: 'crit-leadership', score: 80 },
      { criterionId: 'crit-relevance', score: 90 },
    ],
  };
  // total = 80*1*0.4 + 90*1*0.6 = 32 + 54 = 86

  beforeEach(() => {
    mockApplicationRepo = { findById: jest.fn().mockResolvedValue(makeApplication()) };
    mockScoringRubricRepo = { findActiveRubric: jest.fn() };
    mockGetApplicationReviewHandler = { execute: jest.fn().mockResolvedValue({ id: 'review-1' }) };
    mockTx = {
      applicationReview: {
        upsert: jest.fn().mockResolvedValue({ id: 'review-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      applicationScoreItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      participantApplication: { update: jest.fn() },
    };
    mockPrisma = {
      applicationReview: { findUnique: jest.fn().mockResolvedValue(null) },
      scoringSchema: { findUnique: jest.fn() },
      $transaction: jest.fn((cb) => cb(mockTx)),
    };
    handler = new UpsertApplicationReviewHandler(
      mockApplicationRepo as any,
      mockScoringRubricRepo as any,
      mockGetApplicationReviewHandler as any,
      mockPrisma as any,
    );
  });

  function stub(stage: ScoringStage, rubricOverrides?: Parameters<typeof makeRubric>[1]) {
    const rubric = makeRubric(stage, rubricOverrides);
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(rubric);
    mockPrisma.scoringSchema.findUnique.mockResolvedValue(rubric);
    return rubric;
  }

  it('throws NotFoundException when the application does not exist', async () => {
    mockApplicationRepo.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, validPayload)),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException (409) when no active rubric exists and no review is pinned yet', async () => {
    mockScoringRubricRepo.findActiveRubric.mockResolvedValue(null);
    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, validPayload)),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException (400) with a field-level error when a criterionId is not in the pinned schema', async () => {
    stub(ScoringStage.application);
    const payload = { status: 'draft' as const, items: [{ criterionId: 'crit-not-in-schema', score: 50 }] };

    try {
      await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));
      fail('expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string }> };
      expect(response.errors[0].path).toBe('items[0].criterionId');
    }
  });

  it('throws BadRequestException (400) with a field-level error when a score exceeds maxScore', async () => {
    stub(ScoringStage.application);
    const payload = { status: 'draft' as const, items: [{ criterionId: 'crit-leadership', score: 150 }] };

    try {
      await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));
      fail('expected BadRequestException');
    } catch (e) {
      const response = (e as BadRequestException).getResponse() as { errors: Array<{ path: string }> };
      expect(response.errors[0].path).toBe('items[0].score');
    }
  });

  it('rejects a weighted total that would overflow Decimal(5,2) with 400 instead of clamping', async () => {
    stub(ScoringStage.application, { maxScore: 5000 });
    const payload = {
      status: 'draft' as const,
      items: [
        { criterionId: 'crit-leadership', score: 5000 },
        { criterionId: 'crit-relevance', score: 5000 },
      ],
    };

    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload)),
    ).rejects.toThrow(BadRequestException);
  });

  it('draft: persists items and totalScore but does not touch ParticipantApplication', async () => {
    stub(ScoringStage.application);
    const payload = { ...validPayload, status: 'draft' as const };

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, payload));

    expect(mockTx.applicationReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'draft', totalScore: 86, completedAt: null }),
        update: expect.objectContaining({ status: 'draft', totalScore: 86, completedAt: null }),
      }),
    );
    expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
  });

  it('submitted at the application stage: mirrors totalScore and go_to_interview onto ParticipantApplication when at/above threshold', async () => {
    stub(ScoringStage.application, { passThreshold: 75 });

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.application, 'admin-1', UserRole.ADMIN, validPayload));

    expect(mockTx.applicationReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: 'submitted', totalScore: 86 }) }),
    );
    expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
      where: { id: applicationId },
      data: { scoreTotal: 86, scoreStatus: 'go_to_interview' },
    });
  });

  it('interview PUT on a closed gate: 409 for an ADMIN', async () => {
    stub(ScoringStage.interview);
    mockPrisma.applicationReview.findUnique.mockResolvedValue({
      id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90),
    });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );

    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'admin-1', UserRole.ADMIN, validPayload)),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('interview PUT on a closed gate: succeeds for a SUPER_ADMIN with an override reason and records it', async () => {
    stub(ScoringStage.interview);
    mockPrisma.applicationReview.findUnique.mockResolvedValue({
      id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90),
    });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );
    const payload = { ...validPayload, overrideReason: 'Panel requested an early interview.' };

    await handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'super-1', UserRole.SUPER_ADMIN, payload));

    expect(mockTx.applicationReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ overrideById: 'super-1', overrideReason: 'Panel requested an early interview.' }),
      }),
    );
  });

  it('interview PUT on a closed gate: rejected for a SUPER_ADMIN without an override reason', async () => {
    stub(ScoringStage.interview);
    mockPrisma.applicationReview.findUnique.mockResolvedValue({
      id: 'review-app', schemaId: 'schema-application-v1', status: 'draft', totalScore: new Prisma.Decimal(90),
    });
    mockScoringRubricRepo.findActiveRubric.mockImplementation((_pid: string, stage: ScoringStage) =>
      Promise.resolve(stage === ScoringStage.interview ? makeRubric(ScoringStage.interview) : makeRubric(ScoringStage.application, { passThreshold: 75 })),
    );

    await expect(
      handler.execute(new UpsertApplicationReviewCommand(applicationId, ScoringStage.interview, 'super-1', UserRole.SUPER_ADMIN, validPayload)),
    ).rejects.toThrow(ConflictException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/applications/application/commands/handlers/upsert-application-review.handler.spec.ts` (from `services/api`). Expected: FAIL with `Cannot find module './upsert-application-review.handler'`.

- [ ] **Step 3: Write the command**

```ts
// services/api/src/modules/applications/application/commands/upsert-application-review.command.ts
import { ScoringStage } from '@prisma/client';
import { UserRole } from '@core/entities/user.entity';

export interface UpsertApplicationReviewItemDto {
  criterionId: string;
  score: number;
  notes?: string;
}

export interface UpsertApplicationReviewDto {
  status: 'draft' | 'submitted';
  notes?: string;
  items: UpsertApplicationReviewItemDto[];
  overrideReason?: string;
}

export class UpsertApplicationReviewCommand {
  constructor(
    public readonly applicationId: string,
    public readonly stage: ScoringStage,
    public readonly actingAdminId: string,
    public readonly actingAdminRole: UserRole,
    public readonly payload: UpsertApplicationReviewDto,
  ) {}
}
```

- [ ] **Step 4: Write the handler**

```ts
// services/api/src/modules/applications/application/commands/handlers/upsert-application-review.handler.ts
import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma, ScoringStage, ScoreStatus } from '@prisma/client';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
} from '@core/interfaces/repositories/scoring-rubric.repository.interface';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UserRole } from '@core/entities/user.entity';
import {
  calculateWeightedTotal,
  resolveStageOutcome,
  evaluateInterviewGate,
  WeightValidationError,
  WeightedCategory,
} from '@modules/scoring/domain/scoring-calculation';
import { GetApplicationReviewHandler } from '../../queries/handlers/get-application-review.handler';
import { GetApplicationReviewQuery } from '../../queries/get-application-review.query';
import { ApplicationReviewResponseDto } from '../../dto/application-review-response.dto';
import { UpsertApplicationReviewCommand, UpsertApplicationReviewItemDto } from '../upsert-application-review.command';

// Decimal(5,2) columns (total_score, pass_threshold) top out at 999.99. A rubric with valid
// weights (each level sums to 1.0) can still overflow this if an admin sets an oversized
// maxScore on a criterion — reject before Postgres ever sees it, per the VarChar/Decimal
// overflow defect class already hit three times in this codebase.
const MAX_DECIMAL_5_2 = 999.99;

const SCHEMA_CATEGORIES_INCLUDE = {
  categories: {
    orderBy: { order: 'asc' as const },
    include: { criteria: { orderBy: { order: 'asc' as const } } },
  },
};

function toNumber(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

function toWeightedCategories(schema: ScoringSchemaWithNested): WeightedCategory[] {
  return schema.categories.map((cat) => ({
    categoryId: cat.id,
    categoryWeight: toNumber(cat.weight),
    criteria: cat.criteria.map((crit) => ({
      criterionId: crit.id,
      criterionWeight: toNumber(crit.weight),
      maxScore: toNumber(crit.maxScore),
    })),
  }));
}

function validateItems(
  schema: ScoringSchemaWithNested,
  items: UpsertApplicationReviewItemDto[],
): WeightValidationError[] {
  const maxScoreByCriterionId = new Map<string, number>();
  for (const cat of schema.categories) {
    for (const crit of cat.criteria) {
      maxScoreByCriterionId.set(crit.id, toNumber(crit.maxScore));
    }
  }

  const errors: WeightValidationError[] = [];
  items.forEach((item, i) => {
    const maxScore = maxScoreByCriterionId.get(item.criterionId);
    if (maxScore === undefined) {
      errors.push({
        path: `items[${i}].criterionId`,
        message: `Criterion "${item.criterionId}" does not belong to the pinned rubric schema.`,
      });
      return;
    }
    if (item.score < 0 || item.score > maxScore) {
      errors.push({
        path: `items[${i}].score`,
        message: `Score must be between 0 and ${maxScore} for this criterion.`,
      });
    }
  });
  return errors;
}

@Injectable()
export class UpsertApplicationReviewHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    @Inject('IScoringRubricRepository')
    private readonly scoringRubricRepo: IScoringRubricRepository,
    private readonly getApplicationReviewHandler: GetApplicationReviewHandler,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpsertApplicationReviewCommand): Promise<ApplicationReviewResponseDto> {
    const application = await this.applicationRepository.findById(command.applicationId);
    if (!application) {
      throw new NotFoundException(`Application ${command.applicationId} not found`);
    }

    const existingReview = await this.prisma.applicationReview.findUnique({
      where: { applicationId_stage: { applicationId: command.applicationId, stage: command.stage } },
    });

    // A review pins the schema active at creation time and never silently migrates —
    // resolve the schema to validate/score against from the existing pin, falling back
    // to whatever is active only when this is the very first submission for this stage.
    let pinnedSchemaId = existingReview?.schemaId;
    if (!pinnedSchemaId) {
      const activeRubric = await this.scoringRubricRepo.findActiveRubric(application.programId, command.stage);
      if (!activeRubric) {
        throw new ConflictException(
          `No active "${command.stage}" scoring rubric exists for this program yet. Ask a SuperAdmin to author one on the Rubric page before scoring.`,
        );
      }
      pinnedSchemaId = activeRubric.id;
    }

    const pinnedSchema = (await this.prisma.scoringSchema.findUnique({
      where: { id: pinnedSchemaId },
      include: SCHEMA_CATEGORIES_INCLUDE,
    })) as ScoringSchemaWithNested | null;
    if (!pinnedSchema) {
      throw new NotFoundException(`Pinned scoring schema ${pinnedSchemaId} not found`);
    }

    const itemErrors = validateItems(pinnedSchema, command.payload.items);
    if (itemErrors.length > 0) {
      throw new BadRequestException({ message: 'Review items are invalid.', errors: itemErrors });
    }

    const totalScore = calculateWeightedTotal(
      toWeightedCategories(pinnedSchema),
      command.payload.items.map((item) => ({ criterionId: item.criterionId, score: item.score })),
    );
    if (totalScore > MAX_DECIMAL_5_2 || totalScore < 0) {
      throw new BadRequestException({
        message: 'Weighted total is out of range.',
        errors: [{ path: 'items', message: `Computed total ${totalScore} is outside 0-${MAX_DECIMAL_5_2}.` }],
      });
    }

    let usedOverride = false;
    if (command.stage === ScoringStage.interview) {
      const gate = await this.resolveInterviewGate(application.programId, command.applicationId);
      if (!gate.isOpen) {
        const hasOverrideReason = Boolean(command.payload.overrideReason?.trim());
        if (command.actingAdminRole !== UserRole.SUPER_ADMIN || !hasOverrideReason) {
          throw new ConflictException(
            `Interview scoring is gated: ${gate.reason}. A SUPER_ADMIN may override with a reason.`,
          );
        }
        usedOverride = true;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const review = await tx.applicationReview.upsert({
        where: { applicationId_stage: { applicationId: command.applicationId, stage: command.stage } },
        create: {
          applicationId: command.applicationId,
          schemaId: pinnedSchema.id,
          reviewerId: command.actingAdminId,
          stage: command.stage,
          totalScore,
          notes: command.payload.notes ?? null,
          status: command.payload.status,
          overrideById: usedOverride ? command.actingAdminId : null,
          overrideReason: usedOverride ? command.payload.overrideReason ?? null : null,
          completedAt: command.payload.status === 'submitted' ? new Date() : null,
        },
        update: {
          totalScore,
          notes: command.payload.notes ?? null,
          status: command.payload.status,
          overrideById: usedOverride ? command.actingAdminId : null,
          overrideReason: usedOverride ? command.payload.overrideReason ?? null : null,
          completedAt: command.payload.status === 'submitted' ? new Date() : null,
        },
      });

      // Idempotent replace: delete-then-recreate keeps re-submitting the same payload
      // a no-op in effect, and sidesteps needing per-item upserts keyed on (reviewId, criterionId).
      await tx.applicationScoreItem.deleteMany({ where: { reviewId: review.id } });
      await tx.applicationScoreItem.createMany({
        data: command.payload.items.map((item) => ({
          reviewId: review.id,
          criterionId: item.criterionId,
          score: item.score,
          notes: item.notes ?? null,
        })),
      });

      if (command.payload.status === 'submitted') {
        const outcome = resolveStageOutcome(command.stage, totalScore, toNumber(pinnedSchema.passThreshold));
        await tx.participantApplication.update({
          where: { id: command.applicationId },
          data: { scoreTotal: totalScore, scoreStatus: outcome as ScoreStatus },
        });
      }
    });

    return this.getApplicationReviewHandler.execute(
      new GetApplicationReviewQuery(command.applicationId, command.stage),
    );
  }

  private async resolveInterviewGate(programId: string, applicationId: string) {
    const [applicationStageReview, applicationRubric] = await Promise.all([
      this.prisma.applicationReview.findUnique({
        where: { applicationId_stage: { applicationId, stage: ScoringStage.application } },
      }),
      this.scoringRubricRepo.findActiveRubric(programId, ScoringStage.application),
    ]);

    const threshold = applicationRubric ? toNumber(applicationRubric.passThreshold) : 75;

    return evaluateInterviewGate(
      applicationStageReview
        ? { status: applicationStageReview.status, totalScore: toNumber(applicationStageReview.totalScore) }
        : null,
      threshold,
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/modules/applications/application/commands/handlers/upsert-application-review.handler.spec.ts` (from `services/api`). Expected: PASS, all 10 tests green.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/modules/applications/application/commands/upsert-application-review.command.ts services/api/src/modules/applications/application/commands/handlers/upsert-application-review.handler.ts services/api/src/modules/applications/application/commands/handlers/upsert-application-review.handler.spec.ts
git commit -m "feat: add upsert application review command handler with stage-gated submit"
```

---

## Part B: Cleanup, API Client, UI, Seed (Tasks 9-15)

`services/admin-dashboard` has no test runner. Tasks 10-14 are verified with `npm run lint`, `npm run build`, and an explicit manual verification step. Never write a jest/vitest/Playwright test for an admin-dashboard file. Tasks 9 and 15 live in `services/api` and do get real `npm test -- <path>` runs.
---

### Task 9: Remove dead scoring fields from the review application DTO

**Files:**
- Modify: `services/api/src/modules/applications/presentation/dto/review-application-request.dto.ts`
- Modify: `services/api/src/modules/applications/application/dto/review-application.dto.ts`
- Modify: `services/api/src/modules/applications/application/commands/review-application.command.ts`
- Modify: `services/api/src/modules/applications/application/commands/handlers/review-application.handler.ts:82-85`
- Modify: `services/api/src/modules/applications/presentation/applications.controller.ts:599-608`
- Test: `services/api/src/modules/applications/application/commands/handlers/review-application.handler.spec.ts` (create if it does not already exist; none currently exists for this handler)

**Interfaces:**
- Consumes: nothing from Part A. This task only removes a second, unvalidated write path into `ParticipantApplication.scoreTotal` / `scoreStatus` so the scoring API (Tasks 1-8) becomes the sole writer.
- Produces: `ReviewApplicationCommand(applicationId, reviewerId, status, reviewerNotes?, approvalMode?)` — the new 5-argument constructor shape every future caller of this command must use.

Steps:

- [ ] Run `grep -rn "scoreTotal\|scoreBreakdown\|scoreStatus" services/api/src/modules/applications` from `services/api` to enumerate every reference before touching anything, and separately run `grep -rn "ReviewApplicationCommand(" services/api/src` to confirm the controller at line 599 is the only call site (it is, per the pre-check already run for this plan; re-verify it still holds).
- [ ] In `review-application-request.dto.ts`, delete the `scoreTotal`, `scoreBreakdown`, and `scoreStatus` properties along with their `@ApiPropertyOptional`, `@IsOptional`, `@IsNumber`, `@IsObject`, `@IsEnum` decorators, leaving only `status`, `reviewerNotes`, and `approvalMode`.
- [ ] In the same file, change `import { ApplicationStatus, ScoreStatus } from '@core/entities/participant-application.entity';` to `import { ApplicationStatus } from '@core/entities/participant-application.entity';` since `ScoreStatus` is now unused there, and remove the now-unused `IsNumber`, `IsObject` imports from `class-validator` if `IsEnum`/`IsOptional`/`IsString`/`IsIn` are still needed for the remaining fields (confirm by re-reading the file after the edit; `IsEnum` is still needed for `status`).
- [ ] In `review-application.dto.ts` (application-layer DTO), delete the `scoreTotal`, `scoreBreakdown`, `scoreStatus` fields and update the import to drop `ScoreStatus`, leaving `status` and `reviewerNotes` only.
- [ ] In `review-application.command.ts`, remove the `scoreTotal`, `scoreBreakdown`, `scoreStatus` constructor parameters so the class becomes:
  ```ts
  import { ApplicationStatus } from '@core/entities/participant-application.entity';

  export class ReviewApplicationCommand {
    constructor(
      public readonly applicationId: string,
      public readonly reviewerId: string,
      public readonly status: ApplicationStatus,
      public readonly reviewerNotes?: string,
      public readonly approvalMode?: 'participant' | 'ambassador',
    ) {}
  }
  ```
- [ ] In `review-application.handler.ts`, delete the block at lines 82-85:
  ```ts
  // Update score if provided
  if (command.scoreTotal !== undefined && command.scoreBreakdown && command.scoreStatus) {
    application.updateScore(command.scoreTotal, command.scoreBreakdown, command.scoreStatus);
  }
  ```
  Leave `application.updateScore(...)` itself untouched on the `ParticipantApplication` entity; it stays as the method the scoring API's `PUT /applications/:applicationId/review` handler (Task 3 or wherever Part A wired it) calls to mirror `totalScore` onto `ParticipantApplication`. This task only removes the second caller.
- [ ] In `applications.controller.ts`, update the `review()` method's command construction (currently lines 599-608) to the new 5-argument shape:
  ```ts
  const command = new ReviewApplicationCommand(
    id,
    reviewerId,
    dto.status,
    dto.reviewerNotes,
    dto.approvalMode,
  );
  ```
- [ ] Re-run the grep from step 1 across `services/api/src/modules/applications` and confirm zero remaining references to `scoreTotal`, `scoreBreakdown`, or `scoreStatus` inside `review-application.dto.ts`, `review-application.command.ts`, `review-application.handler.ts`, `review-application-request.dto.ts`, and the `review()` method of `applications.controller.ts`. (Other files such as `applications.controller.ts`'s list/export filters and `export-applications.handler.spec.ts` reference `scoreStatus` for unrelated list-filtering purposes and must be left alone.)
- [ ] Create `services/api/src/modules/applications/application/commands/handlers/review-application.handler.spec.ts` if it does not exist, following the existing jest/`@nestjs/testing` conventions used by sibling handler specs in `services/api/src/modules/applications/application`. Cover: (a) a valid `ACCEPTED` review calls `applicationRepository.update` and does not throw when no score fields are present on the command; (b) reviewing an application not in a reviewable state throws `BadRequestException`; (c) an `ACCEPTED` review with `approvalMode: 'ambassador'` while a `processing`/`paid` invoice exists throws `BadRequestException` via `assertAmbassadorAcceptanceAllowed`. Mock `IApplicationRepository`, `ApplicationMapper`, `CacheService`, `ReferralFunnelService`, and `PrismaService` (with `applicationInvoice.count` and `participantApplication.update`/`applicationInvoice.updateMany` stubbed as needed per case).
- [ ] From `services/api`, run `npm test -- src/modules/applications/application/commands/handlers/review-application.handler.spec.ts` and confirm it passes.
- [ ] From `services/api`, run `npm run build` (or the project's equivalent `tsc` check) and confirm no type errors from the removed fields anywhere in the module (this also catches any caller the grep missed).

---

### Task 10: Api-client methods for application review and rubric versions

**Files:**
- Modify: `services/admin-dashboard/src/shared/api-client.ts:4100-4192` (the existing `// ─── Scoring Rubrics ───` section, appended in place)

**Interfaces:**
- Consumes: `GET /applications/:applicationId/review?stage=application|interview`, `PUT /applications/:applicationId/review?stage=`, `GET /programs/:programId/scoring-rubrics?stage=&version=` from the Shared Interface Contract (delivered by Part A). Reuses the existing `request<T>()` helper and `percentToFraction`/`fractionToPercent` already in this file (lines 4166-4174), and the existing `Rubric`, `RubricCategory`, `RubricCriterion` types (lines 4103-4131) unchanged.
- Produces: `ApplicationReviewResponseDto`, `UpsertApplicationReviewDto`, `GateState`, `StageOutcome`, `RubricVersionSummary` types; `getApplicationReview()`, `upsertApplicationReview()`, `getScoringRubricVersions()`, `getScoringRubricVersion()` functions. Task 11 (`AssessmentForm`) and Task 14 (rubric version history panel) import these by name.

Steps:

- [ ] Read `services/admin-dashboard/src/shared/api-client.ts` lines 1-60 to confirm the exact signature of the shared `request<T>()` helper (it throws on non-2xx and the thrown `Error.message` is inspected elsewhere in this file with `.includes("404")`, e.g. in `fully-funded/[participantId]/page.tsx`) and reuse it as-is; do not add a second HTTP helper.
- [ ] Immediately after the existing `// ─── Scoring Rubrics ─────...` section (after the `upsertScoringRubric` function, current end of file around line 4192), add a new section header `// ─── Rubric Versions ──────────────────────────────────────────────────────` and this type plus function:
  ```ts
  export type RubricVersionSummary = {
    id: string;
    version: number;
    isActive: boolean;
    passThreshold: number;
    createdAt: string;
    createdById: string | null;
    createdByName: string | null;
  };

  /** All versions of a stage's rubric, newest first. Used by the version history panel. */
  export function getScoringRubricVersions(
    programId: string,
    stage: 'application' | 'interview',
  ): Promise<RubricVersionSummary[]> {
    return request<RubricVersionSummary[]>(
      `/programs/${programId}/scoring-rubrics?stage=${stage}`,
    );
  }

  /** A single past version's full category/criteria tree, for the read-only history view. */
  export function getScoringRubricVersion(
    programId: string,
    stage: 'application' | 'interview',
    version: number,
  ): Promise<Rubric> {
    return request<Rubric>(
      `/programs/${programId}/scoring-rubrics?stage=${stage}&version=${version}`,
    );
  }
  ```
  If, once Task 14 is implemented against the real Part A response shape, `GET /programs/:programId/scoring-rubrics?stage=` without a `version` returns a single active `Rubric` rather than an array of `RubricVersionSummary`, adjust `getScoringRubricVersions` to call a second query param or endpoint Part A actually exposes for listing (check `services/api/src/modules/scoring` or wherever Part A's controller for this route lands) rather than guessing further here; the array-of-summaries shape above is this task's contract-consistent design and is not itself defined verbatim in the Shared Interface Contract, so confirm it against Part A's controller before wiring Task 14.
- [ ] Below that, add a new section header `// ─── Application Review (Scoring) ────────────────────────────────────────` with these types, matching the Shared Interface Contract's `ApplicationReviewResponseDto` and `UpsertApplicationReviewDto` field lists exactly:
  ```ts
  export type StageOutcome = 'go_to_interview' | 'rejected' | 'finalist' | 'not_selected';

  export type GateState = {
    isOpen: boolean;
    reason: 'open' | 'no_application_review' | 'application_draft' | 'below_threshold';
    applicationTotal: number | null;
    applicationThreshold: number | null;
  };

  export type ApplicationReviewScoreItem = {
    criterionId: string;
    score: number;
    notes: string | null;
  };

  export type ApplicationReviewResponseDto = {
    id: string | null;
    applicationId: string;
    stage: 'application' | 'interview';
    schemaId: string;
    schemaVersion: number;
    status: 'draft' | 'submitted';
    totalScore: number | null;
    notes: string | null;
    items: ApplicationReviewScoreItem[];
    rubric: Rubric;
    gate: GateState;
    hasNewerRubricVersion: boolean;
  };

  export type UpsertApplicationReviewItemInput = {
    criterionId: string;
    score: number;
    notes?: string;
  };

  export type UpsertApplicationReviewDto = {
    status: 'draft' | 'submitted';
    notes?: string;
    items: UpsertApplicationReviewItemInput[];
    overrideReason?: string;
  };
  ```
  `id` is typed `string | null` because the contract states `GET` returns an empty review shaped against the active schema when none exists yet; that unsaved review has no persisted id.
- [ ] Add the two functions below those types:
  ```ts
  export function getApplicationReview(
    applicationId: string,
    stage: 'application' | 'interview',
  ): Promise<ApplicationReviewResponseDto> {
    return request<ApplicationReviewResponseDto>(
      `/applications/${applicationId}/review?stage=${stage}`,
    );
  }

  export function upsertApplicationReview(
    applicationId: string,
    stage: 'application' | 'interview',
    payload: UpsertApplicationReviewDto,
  ): Promise<ApplicationReviewResponseDto> {
    return request<ApplicationReviewResponseDto>(
      `/applications/${applicationId}/review?stage=${stage}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
  }
  ```
- [ ] Do not touch the pre-existing `reviewApplication()` function (around line 2056) that powers the accept/reject/waitlist flow in `submissions/page.tsx`. It is a separate endpoint (`POST /applications/:id/review`) from the scoring review endpoints added here (`GET`/`PUT /applications/:applicationId/review?stage=`) and Task 9 already stripped its dead score fields server-side; no client-side change is needed for it.
- [ ] From `services/admin-dashboard`, run `npm run lint` and confirm no new lint errors in `src/shared/api-client.ts`.
- [ ] From `services/admin-dashboard`, run `npm run build` and confirm it succeeds. Since nothing imports the new exports yet, a successful build here only proves the new code is syntactically and structurally valid TypeScript, not that it is wired up; Task 11 onward is where real usage validates the shapes against Part A's actual responses.
- [ ] **Manual verification:** none for this task in isolation (it adds no UI). Verification happens through Task 11-14's manual steps, which exercise these functions end to end against the running API.

---

### Task 11: AssessmentForm shared component

**Files:**
- Create: `services/admin-dashboard/src/shared/scoring-calculation.ts`
- Create: `services/admin-dashboard/app/components/scoring/AssessmentForm.tsx`

**Interfaces:**
- Consumes: `getApplicationReview`, `upsertApplicationReview`, `ApplicationReviewResponseDto`, `UpsertApplicationReviewDto`, `GateState`, `ApplicationReviewScoreItem` from Task 10 (`@/src/shared/api-client`); `Rubric`, `RubricCategory`, `RubricCriterion`, `fractionToPercent` also from `@/src/shared/api-client`; `calculateWeightedTotal`, `WeightedCategory`, `WeightedCriterion`, `ScoreInput` from the new local `@/src/shared/scoring-calculation`; `useAuth` from `@/app/contexts/AuthContext` for `accessConfig.isSuperAdmin`; `ApiError` from `@/src/shared/api-client` to detect the 409 no-active-rubric response.
- Produces: `export function AssessmentForm({ applicationId, stage }: AssessmentFormProps)`. Task 12 mounts it in the Scores tab, Task 13 mounts it on the dedicated review route.

Steps:

- [ ] Read `services/api/src/modules/scoring/domain/scoring-calculation.ts` in full (this is Part A's deliverable from Task 1 of `part-a-backend.md`; if it is not yet present because Part A has not landed, stop and re-check before proceeding, since this task cannot be completed without its exact contents).
- [ ] Create `services/admin-dashboard/src/shared/scoring-calculation.ts` as a byte-for-byte copy of that file's exported interfaces, types, and functions (`WeightedCriterion`, `WeightedCategory`, `ScoreInput`, `WeightValidationError`, `calculateWeightedTotal`, `validateWeightSums`, `WEIGHT_SUM_TOLERANCE`, `StageOutcome`, `resolveStageOutcome`, `GateState`, `evaluateInterviewGate`), unchanged line for line except the file-path comment at the top and one added block comment:
  ```ts
  // services/admin-dashboard/src/shared/scoring-calculation.ts
  //
  // MIRROR of services/api/src/modules/scoring/domain/scoring-calculation.ts.
  // This file has zero imports by design (see the Shared Interface Contract in
  // docs/superpowers/plans/2026-08-10-scoring-rubric-versioning-and-assessment-form.md)
  // so it can be copied verbatim across the API/admin-dashboard package boundary
  // with no build wiring. If the API file changes, copy the new contents here
  // unchanged. Do not add framework imports, do not diverge the formula.
  ```
  This mirroring is a deliberate consequence of `services/admin-dashboard` and `services/api` being separate npm packages with no shared workspace linking; the contract's "imported ... through a path alias" is satisfied within each package's own tree (`@/src/shared/scoring-calculation` here), not across packages.
- [ ] **Add the drift guard.** Two copies of the scoring formula is exactly the failure the shared module exists to prevent, so the copies must not be allowed to diverge silently. Create `services/api/src/modules/scoring/domain/scoring-calculation.mirror.spec.ts`:

  ```ts
  // services/api/src/modules/scoring/domain/scoring-calculation.mirror.spec.ts
  import { readFileSync } from 'fs';
  import { join } from 'path';

  // The admin dashboard cannot import from services/api (separate npm packages,
  // no workspace linking), so it keeps a mirror copy. This test fails the moment
  // the two diverge, turning silent score drift into a red build.
  const SOURCE = join(__dirname, 'scoring-calculation.ts');
  const MIRROR = join(
    __dirname,
    '../../../../../admin-dashboard/src/shared/scoring-calculation.ts',
  );

  /** Strip the leading comment block so the two file-path headers can differ. */
  function body(contents: string): string {
    return contents
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n')
      .trim();
  }

  describe('scoring-calculation mirror', () => {
    it('keeps the admin dashboard copy identical to the API source', () => {
      expect(body(readFileSync(MIRROR, 'utf8'))).toBe(
        body(readFileSync(SOURCE, 'utf8')),
      );
    });
  });
  ```

- [ ] Run the drift guard and confirm it passes.

  Run from `services/api`: `npm test -- src/modules/scoring/domain/scoring-calculation.mirror.spec.ts`
  Expected: PASS. If it fails, the mirror copy was not made byte-for-byte; fix the copy rather than loosening the test.

- [ ] Commit the mirror and its guard.

  ```bash
  git add services/admin-dashboard/src/shared/scoring-calculation.ts services/api/src/modules/scoring/domain/scoring-calculation.mirror.spec.ts
  git commit -m "feat: mirror scoring calculation into admin dashboard with drift guard"
  ```

- [ ] Create `services/admin-dashboard/app/components/scoring/AssessmentForm.tsx` with the file-path comment `// services/admin-dashboard/app/components/scoring/AssessmentForm.tsx` at the top and `"use client";` below it.
- [ ] Define:
  ```ts
  interface AssessmentFormProps {
    applicationId: string;
    stage: "application" | "interview";
  }
  ```
- [ ] Implement data loading: on mount and whenever `applicationId` or `stage` changes, call `getApplicationReview(applicationId, stage)`. Track `review: ApplicationReviewResponseDto | null`, `loading: boolean`, `loadError: string | null`, `noRubric: boolean`. In the catch block, check `err instanceof ApiError && err.status === 409` to set `noRubric = true` and stop there (do not treat it as a generic error); for any other error set `loadError` to `err instanceof Error ? err.message : "Failed to load review."`.
- [ ] When `noRubric` is true, render: `<p className="text-sm text-zinc-500">No {stage} rubric has been set up for this program yet. A super admin can create one on the Rubric page.</p>` and stop (no table, no inputs).
- [ ] Maintain local editable state derived from `review.items` once loaded: `scores: Record<string, number | null>` keyed by `criterionId`, and `itemNotes: Record<string, string>` keyed by `criterionId`, seeded from `review.items` on load (missing criteria default to `null` score and `""` notes) and re-seeded whenever a fresh `review` is fetched. Also track `formNotes: string` seeded from `review.notes ?? ""`.
- [ ] Build the row numbering and weighted-total inputs from `review.rubric.categories` (already ordered by `order` per the existing `Rubric`/`RubricCategory`/`RubricCriterion` shape): for category index `ci` (0-based), its letter is `String.fromCharCode(65 + ci)` (`A`, `B`, `C`, ...); for criterion index `ri` within that category (0-based), its row number is `` `${letter}.${ri + 1}` ``. Do not persist these numbers; derive them on every render from array order.
- [ ] Map `review.rubric.categories` into `WeightedCategory[]` for the calculation call:
  ```ts
  const weightedCategories: WeightedCategory[] = review.rubric.categories.map((cat) => ({
    categoryId: cat.id,
    categoryWeight: cat.weight,
    criteria: cat.criteria.map((crit) => ({
      criterionId: crit.id,
      criterionWeight: crit.weight,
      maxScore: crit.maxScore,
    })),
  }));
  ```
  Build `ScoreInput[]` from `scores`, skipping any `criterionId` whose value is still `null`: `Object.entries(scores).filter(([, v]) => v != null).map(([criterionId, score]) => ({ criterionId, score: score as number }))`.
- [ ] Compute the live grand total with `calculateWeightedTotal(weightedCategories, scoreInputs)` on every render (it is a pure function over local state, safe to call directly in the render body; do not wrap it in `useMemo` unless a real performance issue shows up, since the category/criteria arrays are small).
- [ ] Compute each category's subtotal client-side using the same documented formula (`score * criterionWeight * categoryWeight`, summed, rounded to 2dp for display only) so the reviewer can see how each section contributes, since `calculateWeightedTotal` only returns the whole-rubric total:
  ```ts
  function categorySubtotal(cat: RubricCategory, scores: Record<string, number | null>): number {
    const sum = cat.criteria.reduce((acc, crit) => {
      const score = scores[crit.id];
      if (score == null) return acc;
      return acc + score * crit.weight * cat.weight;
    }, 0);
    return Math.round(sum * 100) / 100;
  }
  ```
- [ ] Render one `<table>` (or semantic section, see `services/admin-dashboard/app/programs/[programId]/scoring/rubric/RubricBuilderClient.tsx` for the surrounding Tailwind conventions to match: `rounded-lg border bg-white p-4 shadow-sm` cards, `text-sm`/`text-xs text-zinc-500` for secondary text) per category, headed by `` `${letter}. ${category.name}` `` and `` `Weight: ${fractionToPercent(category.weight)}%` ``, with a table of columns `Component`, `Weight (%)`, `Score`:
  - `Component` cell shows `` `${rowNumber} ${criterion.name}` ``.
  - `Weight (%)` cell shows `fractionToPercent(criterion.weight).toFixed(2)` as plain read-only text, not an input.
  - `Score` cell is a bounded numeric `<input type="number" min={0} max={criterion.maxScore} step={1}>` bound to `scores[criterion.id] ?? ""`, disabled when `review.status === "submitted"`, `onChange` clamps to `[0, criterion.maxScore]` before storing (reject non-numeric input by ignoring the change rather than storing `NaN`).
  - After the rows, a subtotal line: `` `Subtotal: ${categorySubtotal(cat, scores)}` ``.
- [ ] Below all category sections, render the running grand total prominently (e.g. `<div className="flex items-center justify-between border-t pt-4 text-base font-semibold"><span>Total Score</span><span>{calculateWeightedTotal(weightedCategories, scoreInputs)}</span></div>`) and a free-text `formNotes` textarea bound to the review's overall notes, disabled when submitted.
- [ ] Implement the closed-gate warning, shown only when `stage === "interview" && review && !review.gate.isOpen`, above the score table (the table still renders underneath for a `SUPER_ADMIN` who overrides, but is disabled until the override is applied):
  - Compute a human message from `review.gate.reason`: `no_application_review` → "The application stage has not been reviewed yet.", `application_draft` → "The application stage review is still a draft.", `below_threshold` → `` `The application score (${review.gate.applicationTotal}) is below the pass threshold (${review.gate.applicationThreshold}).` ``, `open` → do not render the warning at all (should not happen given the outer condition, but guard for it).
  - For an `ADMIN` (not `accessConfig.isSuperAdmin`), render the message only, with the score inputs `disabled`.
  - For a `SUPER_ADMIN`, additionally render a reason `<input>` (`overrideReasonDraft: string` local state) and a button "Override and open form", disabled until `overrideReasonDraft.trim().length > 0`. Clicking it does not call the API yet; it sets a local `overrideApplied: boolean` and stores `overrideReasonDraft` into an `overrideReason` state that gets sent on the next save, and enables the score inputs. This mirrors the spec: "records `overrideById` and `overrideReason` on the interview `ApplicationReview`" happens server-side on `PUT`, triggered by this client state existing.
- [ ] Implement Save (draft) and Submit actions, both calling `upsertApplicationReview(applicationId, stage, payload)`:
  ```ts
  const payload: UpsertApplicationReviewDto = {
    status: nextStatus, // "draft" for Save, "submitted" for Submit
    notes: formNotes || undefined,
    items: Object.entries(scores)
      .filter(([, v]) => v != null)
      .map(([criterionId, score]) => ({
        criterionId,
        score: score as number,
        notes: itemNotes[criterionId] || undefined,
      })),
    overrideReason: overrideApplied ? overrideReasonDraft : undefined,
  };
  ```
  On success, replace local `review` state with the response (so `status`, `totalScore`, `gate`, and `hasNewerRubricVersion` reflect the server) and re-seed `scores`/`itemNotes`/`formNotes` from it. On failure, surface `err instanceof Error ? err.message : "Failed to save review."` near the Save/Submit controls without clearing unsaved input (explicit save only, no autosave, no silent data loss on error).
- [ ] Submit is disabled (`<button disabled>`) until every criterion across every category has a non-null score in `scores`: `const allScored = review.rubric.categories.every((cat) => cat.criteria.every((crit) => scores[crit.id] != null));`. Save (draft) has no such requirement and is always enabled while not submitted.
- [ ] When `review.status === "submitted"`, render the whole form read-only (all inputs `disabled`, no Save/Submit buttons) and show a single "Reopen" button. Reopen calls `upsertApplicationReview(applicationId, stage, { status: "draft", notes: formNotes, items: <the same items just displayed>, overrideReason: overrideApplied ? overrideReasonDraft : undefined })`, i.e. it resubmits the exact current items with `status: "draft"` so no score data is lost, then updates local state from the response so the form becomes editable again.
- [ ] When `review.hasNewerRubricVersion` is true, render a small notice above the table, non-blocking: `<p className="text-xs text-amber-600">A newer rubric version exists. This review stays pinned to version {review.schemaVersion} of the rubric.</p>`.
- [ ] Do not add any `localStorage` read or write anywhere in this file. Do not add a `setInterval`/`setTimeout`-based autosave. Grep the finished file for `localStorage` and `setInterval` before moving on and confirm both are absent.
- [ ] From `services/admin-dashboard`, run `npm run lint` and `npm run build`. Fix any type errors, in particular around the `scores` record's `number | null` values flowing into `<input value={...}>` (coerce `null` to `""` at the JSX boundary, never store `""` in the `scores` record itself).
- [ ] **Manual verification:** this component has no route of its own yet; defer manual verification to Task 12 and Task 13, which mount it. Confirm here only that `npm run build` succeeds with zero references to the component (it is currently unused, which is expected and not a lint error since it is exported).

---

### Task 12: Mount AssessmentForm in the participant Scores tab

**Files:**
- Modify: `services/admin-dashboard/app/components/scoring/FullyFundedDetailsTabsCard.tsx:1-78` (imports and the `Scores` tab render branch), and `:280-310` (the `ScoresContent` function, replaced)

**Interfaces:**
- Consumes: `AssessmentForm` from Task 11 (`@/app/components/scoring/AssessmentForm`), reading `application.id` (already present on the `Application` type at `services/admin-dashboard/src/shared/api-client.ts:568`) as `applicationId`.
- Produces: nothing new consumed by later tasks; this is a leaf mount point.

Steps:

- [ ] In `FullyFundedDetailsTabsCard.tsx`, add the import `import { AssessmentForm } from "@/app/components/scoring/AssessmentForm";` alongside the existing imports at the top of the file.
- [ ] Replace the current Scores tab render branch (currently lines 69-74):
  ```tsx
  {!hideScores && activeTab === "Scores" && (
    <ScoresContent
      scoreTotal={application?.scoreTotal}
      scoreStatus={application?.scoreStatus}
    />
  )}
  ```
  with:
  ```tsx
  {!hideScores && activeTab === "Scores" && (
    <ScoresContent application={application} />
  )}
  ```
- [ ] Replace the `ScoresContent` function (currently lines 280-310) so it renders both stages, application first and interview below it, instead of the old read-only summary:
  ```tsx
  function ScoresContent({ application }: { application?: Application }) {
    if (!application?.id) {
      return (
        <div className="text-sm text-zinc-500">
          This application has not been scored yet.
        </div>
      );
    }

    return (
      <div className="space-y-10">
        <section>
          <h3 className="mb-4 text-base font-semibold text-zinc-900">
            Application Stage
          </h3>
          <AssessmentForm applicationId={application.id} stage="application" />
        </section>
        <section>
          <h3 className="mb-4 text-base font-semibold text-zinc-900">
            Interview Stage
          </h3>
          <AssessmentForm applicationId={application.id} stage="interview" />
        </section>
      </div>
    );
  }
  ```
  This removes the old `scoreTotal`/`scoreStatus`-only display entirely; `AssessmentForm` now owns rendering both the live score and the submitted state for each stage. Delete the now-unused `BadgeValue`-based summary block that lived inside the old `ScoresContent` (it no longer applies; leave `BadgeValue` itself in the file since `Field`'s `asBadge` prop still uses it elsewhere, e.g. education level and achievement fields).
- [ ] Re-check that `scoreTotal`/`scoreStatus` are no longer read anywhere in this file after the edit (`grep -n "scoreTotal\|scoreStatus" services/admin-dashboard/app/components/scoring/FullyFundedDetailsTabsCard.tsx` should return nothing); the `Application` type itself still carries those fields for list/filter views elsewhere and is untouched.
- [ ] From `services/admin-dashboard`, run `npm run lint` and `npm run build` and confirm both pass.
- [ ] **Manual verification:** start the admin dashboard against a program that has an active application-stage rubric (per Task 15's seed) and at least one fully-funded participant application. Navigate to that program's Fully Funded participant detail page (`/programs/[programId]/scoring/fully-funded/[participantId]`), click the "Scores" tab, and confirm: (1) an "Application Stage" section renders a table of categories/criteria with read-only weight percentages and empty score inputs; (2) entering a score in every row updates a live running total; (3) an "Interview Stage" section renders below it, showing the closed-gate warning (since no application review has been submitted yet) instead of an editable table; (4) clicking Save on the application stage persists without a page reload, and reloading the page shows the same scores restored from the server.

---

### Task 13: Dedicated application review route

**Files:**
- Create: `services/admin-dashboard/app/programs/[programId]/scoring/review/[applicationId]/page.tsx`

**Interfaces:**
- Consumes: `AssessmentForm` from Task 11; `getApplication` from `@/src/shared/api-client` (existing function, used unchanged, see `services/admin-dashboard/src/shared/api-client.ts:2000-2002`); `useResolvedProgramId` from `@/app/hooks/useResolvedProgramId`.
- Produces: the route `/programs/[programId]/scoring/review/[applicationId]?stage=application|interview`, a shareable URL for a focused review session. Nothing later in this plan depends on this task's exports; it is a leaf route.

Steps:

- [ ] Create the directory `services/admin-dashboard/app/programs/[programId]/scoring/review/[applicationId]/` and the file `page.tsx` inside it, with the file-path comment `// services/admin-dashboard/app/programs/[programId]/scoring/review/[applicationId]/page.tsx`, `"use client";`, and imports matching the pattern in `app/programs/[programId]/scoring/fully-funded/[participantId]/page.tsx`: `useParams`, `useSearchParams`, `useRouter` from `next/navigation`; `getApplication`, `type Application` from `@/src/shared/api-client`; `useResolvedProgramId` from `@/app/hooks/useResolvedProgramId`; `AssessmentForm` from `@/app/components/scoring/AssessmentForm`.
- [ ] Read `applicationId` from `useParams<{ programId: string; applicationId: string }>()`. Resolve `programId` through `useResolvedProgramId(params.programId)` even though the review endpoints themselves are not program-scoped, because every other page in this route tree resolves it for consistency and any future program-scoped call (e.g. a "back to program" link) needs the resolved id, not the slug.
- [ ] Read the stage from `useSearchParams().get("stage")`, defaulting to `"application"` when absent or not one of `"application" | "interview"`. Use `useRouter().replace` with `next/navigation`'s `usePathname()` plus a rebuilt `URLSearchParams` to update `?stage=` when the reviewer switches tabs, so the URL stays shareable and a page refresh preserves the selected stage.
- [ ] Fetch the application once on mount via `getApplication(applicationId)` (mirroring the loading/notFound state pattern already used in `fully-funded/[participantId]/page.tsx`: `loading`, `notFound`, and a `useState<Application | null>(null)`), for header display (participant name, program) only; `AssessmentForm` fetches its own review data independently via `applicationId` and does not need the `Application` object passed into it.
- [ ] Render a header showing the participant's name (`application.participant?.fullName`), program category/status badges consistent with existing header card styling (reuse `FullyFundedHeaderCard` if its props fit, e.g. when `application.applicationCategory === "fully_funded"`; otherwise a simpler local header block is acceptable, since this route is meant to work for any application category, not only fully-funded), and a stage switcher of two buttons/tabs, "Application" and "Interview", where clicking one sets the URL's `?stage=` and the active tab styling matches the existing `STAGES`/`STAGE_LABELS` tab pattern in `RubricBuilderClient.tsx` (`border-b-2 border-blue-500 text-blue-600` for the active tab, `text-zinc-500 hover:text-zinc-900` otherwise).
- [ ] Below the header and stage switcher, render `<AssessmentForm applicationId={applicationId} stage={stage} />`.
- [ ] Handle `loading` (a simple centered "Loading application..." message, matching the existing pattern) and `notFound` (centered "Application not found." message) states before rendering the header and form.
- [ ] From `services/admin-dashboard`, run `npm run lint` and `npm run build` and confirm both pass.
- [ ] **Manual verification:** navigate directly to `/programs/<a-real-program-slug>/scoring/review/<a-real-application-id>` (grab a real application id from the Fully Funded list or the network tab). Confirm: (1) the page loads the participant's name in the header; (2) it defaults to the Application stage tab; (3) clicking the Interview tab updates the URL to include `?stage=interview` without a full page reload, and clicking browser back returns to `?stage=application` with the application form showing again; (4) refreshing the page while `?stage=interview` is in the URL loads directly into the interview stage.

---

### Task 14: Rubric builder hardening and version history panel

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/scoring/rubric/RubricBuilderClient.tsx` (weight-sum validation, warning text, and Save gating throughout; a new version history section appended to the returned JSX and its supporting state/handlers)
- Modify: `services/admin-dashboard/src/shared/api-client.ts` (only if the assumption in step 2 below turns out to be wrong; see that step)

**Interfaces:**
- Consumes: `validateWeightSums`, `WEIGHT_SUM_TOLERANCE`, `WeightedCategory`, `WeightedCriterion` from `@/src/shared/scoring-calculation` (Task 11); `getScoringRubricVersions`, `getScoringRubricVersion`, `RubricVersionSummary` from `@/src/shared/api-client` (Task 10); the existing `getScoringRubrics`, `upsertScoringRubric`, `percentToFraction`, `fractionToPercent`, `Rubric`, `UpsertRubricInput` already imported in this file.
- Produces: nothing consumed elsewhere in this plan; this is the last task that touches the Rubric page.

Steps:

- [ ] Assumption check: this task needs to know, for the active version of the stage being edited, whether any submitted `ApplicationReview` rows exist against it, so it can warn before a new version supersedes it. Check whether `RubricVersionSummary` (added in Task 10) already exposes this, or whether Part A's actual `GET /programs/:programId/scoring-rubrics?stage=` response includes an equivalent flag on the active entry (check the real controller/handler Part A built, likely under `services/api/src/modules/scoring` or `services/api/src/modules/programs`). If it is missing from both, add `hasSubmittedReviews: boolean` to the `RubricVersionSummary` type in `services/admin-dashboard/src/shared/api-client.ts` now (a client-side type addition only) and note in the commit message that the backend field it expects does not exist yet, so it is a known follow-up for whoever owns `part-a-backend.md`'s endpoint; do not attempt to add the backend field yourself, that is out of scope for this file.
- [ ] Delete the "Scores will be normalized on computation" text in both places it currently appears: the per-category criterion-sum warning inside `CategoryCard` (currently around the `critSumWarning` block) and the top-level category-sum warning inside the main component (currently around the `catSumWarning` block). No normalization exists anywhere in the API; the message was false and is being removed, not reworded.
- [ ] Replace the `sumWeights`-based percent-arithmetic warnings with a validation call against the shared pure module. Build a mapper from the local percentage-based `RubricState` to `WeightedCategory[]`:
  ```ts
  function stateToWeightedCategories(state: RubricState): WeightedCategory[] {
    return state.categories.map((cat) => ({
      categoryId: cat.id ?? `draft-${cat.order}`,
      categoryWeight: percentToFraction(cat.weightPct),
      criteria: cat.criteria.map((crit) => ({
        criterionId: crit.id ?? `draft-${crit.order}`,
        criterionWeight: percentToFraction(crit.weightPct),
        maxScore: crit.maxScore,
      })),
    }));
  }
  ```
  Call `validateWeightSums(stateToWeightedCategories(current))` wherever `catSumWarning`/`critSumWarning` were computed, and derive a single `weightErrors: WeightValidationError[]` for the active stage's state, recomputed on every render (cheap, no `useMemo` needed for this data size).
- [ ] Render `weightErrors` as blocking, not advisory: a red (not amber) message block listing each `error.path`/`error.message` pair, and disable the Save button (`disabled={isSaving || weightErrors.length > 0}`) so it is impossible to submit unbalanced weights from the client, matching the server-side 400 that Part A's `upsert-scoring-rubric.handler.ts` now enforces (this task assumes that server validation already exists from `part-a-backend.md`; the client check here is a UX improvement, not a substitute, since the server remains the source of truth).
- [ ] Before the existing `handleSave` calls `upsertScoringRubric`, look up whether the currently active version for `activeStage` has `hasSubmittedReviews === true` (from a `getScoringRubricVersions(programId, activeStage)` call, filtering for `isActive`). If so, show a confirmation step: replace the immediate save with a two-phase flow — a "Save rubric" click when submitted reviews exist against the active version first shows an inline warning "This program has submitted reviews scored against the current rubric version. Saving creates a new version; those reviews stay pinned to their original version and are not affected." with "Confirm and save" / "Cancel" buttons, and only calls `upsertScoringRubric` after "Confirm and save". When no submitted reviews exist against the active version, Save behaves exactly as it does today (immediate).
- [ ] Add a `loadVersionSummaries` effect/callback, mirroring the existing `loadRubrics` pattern, that calls `getScoringRubricVersions(programId, activeStage)` whenever `programId` or `activeStage` changes, storing the result in `versionSummaries: RubricVersionSummary[]`.
- [ ] Add a new section below the existing "Save section" in the returned JSX, headed "Version History", rendering `versionSummaries` newest-first (the function already returns newest-first per Task 10) as a simple list: version number, `createdByName ?? "Unknown"`, a formatted `createdAt` (reuse whatever date formatting utility other admin-dashboard pages already use, e.g. `formatDate` from `@/lib/utils` as seen in `FullyFundedDetailsTabsCard.tsx`), and an "Active" badge on the entry where `isActive` is true. Each non-active row has a "View" button.
- [ ] Clicking "View" on a past version calls `getScoringRubricVersion(programId, activeStage, version)` and opens a read-only panel (a simple conditional block below the list, or a modal if this codebase already has a modal primitive in `app/components/ui`; check before introducing a new one) rendering that version's categories/criteria/weights using the same `rubricToState`-style mapping already in this file, but with every input replaced by plain read-only text (no `<input>` elements) and no Save button. Add a "Close" action that clears the panel state.
- [ ] From `services/admin-dashboard`, run `npm run lint` and `npm run build` and confirm both pass.
- [ ] **Manual verification:** as a super admin, open a program's Rubric page (`/programs/[programId]/scoring/rubric`). Confirm: (1) editing a category weight so the category sums no longer total 100% shows a red blocking message and disables Save (not the old amber "will be normalized" text, which must not appear anywhere); (2) fixing the weights back to summing to 100% re-enables Save; (3) saving successfully mints a new version and the Version History section lists it as version N with "Active", and the previous version now shows without the Active badge; (4) clicking "View" on the previous version shows its categories/criteria as read-only text, not editable inputs; (5) if a submitted review exists against the active version (score an application via Task 12/13 first, then return here), saving again shows the two-phase confirmation warning before it actually saves.

---

### Task 15: Idempotent rubric seed and backfill

**Files:**
- Modify: `services/api/prisma/seeds/seed-scoring.ts` (full rewrite)
- Test: `services/api/prisma/seeds/seed-scoring.spec.ts` (create)

**Interfaces:**
- Consumes: `prisma`, `log` from `./utils` (existing, used unchanged); `ScoringSchema.version`, `ScoringSchema.passThreshold`, `ScoringSchema @@unique([programId, stage, version])` and the `ScoringStage` enum from the Shared Interface Contract (delivered by Part A's Prisma migration).
- Produces: `export async function seedScoring()`, same exported name and shape as today so whatever seed-runner entrypoint calls it (check `services/api/prisma/seeds/index.ts` or equivalent orchestrator and confirm the call site needs no change) keeps working unmodified.

Steps:

- [ ] Read `services/api/prisma/seeds/utils.ts` for the `prisma` and `log` exports, and grep `services/api/prisma/seeds` for whatever file imports and calls `seedScoring()` today, to confirm the exported function name and zero-argument signature must stay identical.
- [ ] Confirm the exact Prisma field names for stage on `ScoringSchema` (per the contract, reviews carry `ApplicationReview.stage`, but rubrics are queried "per program, per stage"; check the actual `services/api/prisma/schema/scoring.prisma` after Part A's Task 2 migration for whether `ScoringSchema` itself has a `stage` column or whether stage is inferred some other way) before writing any query filtering by stage, since guessing the column name wrong here would silently seed into the wrong stage or throw a Prisma validation error.
- [ ] Rewrite `seedScoring()` to replace the current single-program IYS-2026-only, non-idempotent implementation with a backfill over every program:
  ```ts
  import { prisma, log } from './utils';

  const APPLICATION_STAGE_RUBRIC = {
    name: 'Application Assessment Rubric',
    description: 'Default application-stage scoring rubric ported from the legacy assessment forms.',
    passThreshold: 75,
    categories: [
      {
        name: 'Achievement and Experience',
        weight: 0.4,
        order: 1,
        criteria: [
          { name: 'Project Experiences', weight: 0.3, maxScore: 100, order: 1 },
          { name: 'Achievement', weight: 0.4, maxScore: 100, order: 2 },
          { name: 'Leadership', weight: 0.3, maxScore: 100, order: 3 },
        ],
      },
      {
        name: 'Essay Assessment',
        weight: 0.6,
        order: 2,
        criteria: [
          { name: 'Topic Relevance to SDGs Themes', weight: 0.3, maxScore: 100, order: 1 },
          { name: 'Argumentation, Innovation, and Creativity', weight: 0.5, maxScore: 100, order: 2 },
          { name: 'Validity of Sources and References', weight: 0.1, maxScore: 100, order: 3 },
          { name: 'Writing Format', weight: 0.1, maxScore: 100, order: 4 },
        ],
      },
    ],
  } as const;

  export async function seedScoring(): Promise<void> {
    log('Seeding application-stage scoring rubrics...');

    const programs = await prisma.program.findMany({ select: { id: true, name: true } });

    let created = 0;
    let skipped = 0;

    for (const program of programs) {
      const existingActive = await prisma.scoringSchema.findFirst({
        where: {
          programId: program.id,
          stage: 'application',
          isActive: true,
        },
        select: { id: true },
      });

      if (existingActive) {
        skipped += 1;
        log(`  skip  ${program.name}: active application rubric already exists`);
        continue;
      }

      await prisma.scoringSchema.create({
        data: {
          programId: program.id,
          stage: 'application',
          version: 1,
          isActive: true,
          name: APPLICATION_STAGE_RUBRIC.name,
          description: APPLICATION_STAGE_RUBRIC.description,
          passThreshold: APPLICATION_STAGE_RUBRIC.passThreshold,
          categories: {
            create: APPLICATION_STAGE_RUBRIC.categories.map((cat) => ({
              name: cat.name,
              weight: cat.weight,
              order: cat.order,
              criteria: {
                create: cat.criteria.map((crit) => ({
                  name: crit.name,
                  weight: crit.weight,
                  maxScore: crit.maxScore,
                  order: crit.order,
                })),
              },
            })),
          },
        },
      });

      created += 1;
      log(`  create ${program.name}: application rubric v1 created`);
    }

    log(`Application rubric backfill complete: ${created} created, ${skipped} skipped (already had an active rubric).`);
    log('No interview-stage rubric is seeded; a super admin authors one on the Rubric page when ready.');
  }
  ```
  Adjust the `stage: 'application'` literal to whatever the real `ScoringStage` enum member name is once confirmed in the step above (it may be an imported Prisma enum value rather than a bare string, e.g. `ScoringStage.application` from `@prisma/client`); do not guess silently, use the actual generated type.
- [ ] Delete the old hardcoded single-program logic entirely (the `BRANDS.IYS` lookup, the single `iys2026` program lookup, the simulated "Alex Winner" review and score items). Seeding a fake submitted review is out of scope for a rubric backfill and the spec explicitly says "No interview-stage rubric is seeded" and says nothing about seeding fake reviews; remove that responsibility from this script rather than porting it forward. If `BRANDS` import from `./seed-brands` becomes unused after this change, remove that import too.
- [ ] Create `services/api/prisma/seeds/seed-scoring.spec.ts` following whichever test pattern this project's other seed scripts already use (check for sibling `*.spec.ts` files under `services/api/prisma/seeds/`; if none exist, use the same jest + `@nestjs/testing`-free plain jest style as other `services/api` unit specs, mocking `PrismaClient` methods directly rather than hitting a real database). Cover: (a) a program with no active application rubric gets one created with `version: 1` and the exact category/criterion weights above; (b) a program that already has an active application rubric is skipped and no second `scoringSchema.create` call is made for it; (c) running the function twice in sequence (second run against a mocked-as-now-existing state) results in zero additional creates on the second run; (d) no `stage: 'interview'` rows are ever created by this function.
- [ ] From `services/api`, run `npm test -- prisma/seeds/seed-scoring.spec.ts` (adjust the path to match wherever jest's `testMatch`/`roots` config actually picks up seed specs, per `services/api/jest.config.*`) and confirm it passes.
- [ ] From `services/api`, run the actual seed against a real (non-production, e.g. local/staging) database once via whatever the existing seed-runner command is (check `services/api/package.json` for a `prisma:seed` or similar script), then run it a second time immediately after, and confirm the second run's log output shows every program as "skip" with zero new `ScoringSchema` rows created (verify via `SELECT program_id, stage, version, is_active, count(*) FROM scoring_schemas GROUP BY 1,2,3,4` or the Prisma Studio equivalent, confirming no duplicate `(programId, stage, version)` rows, consistent with the `@@unique([programId, stage, version])` constraint Part A added).

## Deferred

Adding a vitest (or equivalent) setup to `services/admin-dashboard` so the frontend unit and E2E tests the design spec calls for (weighted-total display, gate rendering, Reopen flow, and Playwright coverage of the assessment form and rubric history panel) can actually be written is approved follow-up work, deliberately excluded from this plan. Every frontend task above substitutes `npm run lint` plus `npm run build` plus an explicit manual verification script in its place, which is sufficient to ship this milestone but is not a substitute for automated regression coverage once a runner exists.
