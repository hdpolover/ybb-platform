// services/admin-dashboard/lib/readiness-summary.test.ts
/**
 * Standalone test for the readiness summary helpers.
 * The admin dashboard has no test framework; run directly with Node's native
 * TypeScript support:  node lib/readiness-summary.test.ts
 */
import assert from "node:assert/strict";
import { summarize, staleness } from "./readiness-summary.ts";

function t(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

t("counts subjects with blockers, not total blockers", () => {
  const result = summarize([
    { subjectType: "brand", subjectId: "b1", brandId: "b1", blockerCount: 3, warningCount: 1, evaluatedAt: new Date().toISOString() },
    { subjectType: "brand", subjectId: "b2", brandId: "b2", blockerCount: 0, warningCount: 2, evaluatedAt: new Date().toISOString() },
  ]);
  assert.equal(result.subjectsWithBlockers, 1);
  assert.equal(result.totalBlockers, 3);
  assert.equal(result.subjectsClear, 1);
});

t("reports an empty fleet without dividing by zero", () => {
  const result = summarize([]);
  assert.equal(result.subjectsWithBlockers, 0);
  assert.equal(result.subjectsClear, 0);
});

t("labels a snapshot older than 48 hours as stale", () => {
  const old = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  assert.equal(staleness(old), "stale");
});

t("labels a fresh snapshot as current", () => {
  assert.equal(staleness(new Date().toISOString()), "current");
});
