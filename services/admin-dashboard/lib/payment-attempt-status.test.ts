// services/admin-dashboard/lib/payment-attempt-status.test.ts
/**
 * Standalone test for the payment-attempt status fallback helper.
 * The admin dashboard has no test framework; run directly with Node's native
 * TypeScript support:  node lib/payment-attempt-status.test.ts
 */
import assert from "node:assert/strict";
import { resolveAttemptDisplayStatus, resolveAttemptRowDisplayStatus } from "./payment-attempt-status.ts";

let passed = 0;
function t(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ✓", name);
}

t("cancelled invoice overrides a live PENDING txn status", () => {
  assert.equal(resolveAttemptDisplayStatus("cancelled", "PENDING"), "cancelled");
});

t("failed invoice overrides a live NEEDS_REVIEW txn status", () => {
  assert.equal(resolveAttemptDisplayStatus("failed", "NEEDS_REVIEW"), "failed");
});

t("refunded invoice overrides a live SUCCESS txn status", () => {
  assert.equal(resolveAttemptDisplayStatus("refunded", "SUCCESS"), "refunded");
});

t("processing invoice shows the real txn status unchanged", () => {
  assert.equal(resolveAttemptDisplayStatus("processing", "PENDING"), "PENDING");
});

t("paid invoice shows the real txn status unchanged", () => {
  assert.equal(resolveAttemptDisplayStatus("paid", "SUCCESS"), "SUCCESS");
});

t("undefined txn status with a non-terminal invoice stays undefined", () => {
  assert.equal(resolveAttemptDisplayStatus("unpaid", undefined), undefined);
});

t("terminal invoice overrides a live PENDING attempt row", () => {
  assert.equal(resolveAttemptRowDisplayStatus("PENDING", "cancelled"), "cancelled");
});

t("terminal invoice leaves a terminal VOID attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("VOID", "cancelled"), "VOID");
});

t("terminal invoice leaves a terminal FAILED attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("FAILED", "failed"), "FAILED");
});

t("terminal invoice leaves a terminal SUCCESS attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("SUCCESS", "refunded"), "SUCCESS");
});

t("non-terminal invoice leaves a PENDING attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("PENDING", "processing"), "PENDING");
});

t("non-terminal invoice leaves a SUCCESS attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("SUCCESS", "paid"), "SUCCESS");
});

console.log(`\n${passed} passed`);
