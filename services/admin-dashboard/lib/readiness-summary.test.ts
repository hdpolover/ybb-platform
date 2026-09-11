// services/admin-dashboard/lib/readiness-summary.test.ts
/**
 * Vitest suite for the readiness summary helpers.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { summarize, staleness } from "./readiness-summary.ts";

describe("readiness-summary", () => {

it("counts subjects with blockers, not total blockers", () => {
  const result = summarize([
    { subjectType: "brand", subjectId: "b1", brandId: "b1", blockerCount: 3, warningCount: 1, evaluatedAt: new Date().toISOString() },
    { subjectType: "brand", subjectId: "b2", brandId: "b2", blockerCount: 0, warningCount: 2, evaluatedAt: new Date().toISOString() },
  ]);
  assert.equal(result.subjectsWithBlockers, 1);
  assert.equal(result.totalBlockers, 3);
  assert.equal(result.subjectsClear, 1);
});

it("reports an empty fleet without dividing by zero", () => {
  const result = summarize([]);
  assert.equal(result.subjectsWithBlockers, 0);
  assert.equal(result.subjectsClear, 0);
});

it("labels a snapshot older than 48 hours as stale", () => {
  const old = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  assert.equal(staleness(old), "stale");
});

it("labels a fresh snapshot as current", () => {
  assert.equal(staleness(new Date().toISOString()), "current");
});
});
