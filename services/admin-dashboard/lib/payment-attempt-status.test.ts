// services/admin-dashboard/lib/payment-attempt-status.test.ts
/**
 * Vitest suite for the payment-attempt status fallback helper.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { resolveAttemptDisplayStatus, resolveAttemptRowDisplayStatus } from "./payment-attempt-status.ts";

describe("payment-attempt-status", () => {

it("cancelled invoice overrides a live PENDING txn status", () => {
  assert.equal(resolveAttemptDisplayStatus("cancelled", "PENDING"), "cancelled");
});

it("failed invoice overrides a live NEEDS_REVIEW txn status", () => {
  assert.equal(resolveAttemptDisplayStatus("failed", "NEEDS_REVIEW"), "failed");
});

it("refunded invoice overrides a live SUCCESS txn status", () => {
  assert.equal(resolveAttemptDisplayStatus("refunded", "SUCCESS"), "refunded");
});

it("processing invoice shows the real txn status unchanged", () => {
  assert.equal(resolveAttemptDisplayStatus("processing", "PENDING"), "PENDING");
});

it("paid invoice shows the real txn status unchanged", () => {
  assert.equal(resolveAttemptDisplayStatus("paid", "SUCCESS"), "SUCCESS");
});

it("undefined txn status with a non-terminal invoice stays undefined", () => {
  assert.equal(resolveAttemptDisplayStatus("unpaid", undefined), undefined);
});

it("terminal invoice overrides a live PENDING attempt row", () => {
  assert.equal(resolveAttemptRowDisplayStatus("PENDING", "cancelled"), "cancelled");
});

it("terminal invoice leaves a terminal VOID attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("VOID", "cancelled"), "VOID");
});

it("terminal invoice leaves a terminal FAILED attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("FAILED", "failed"), "FAILED");
});

it("terminal invoice leaves a terminal SUCCESS attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("SUCCESS", "refunded"), "SUCCESS");
});

it("terminal invoice leaves a terminal REJECTED attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("REJECTED", "cancelled"), "REJECTED");
});

it("terminal invoice overrides a live NEEDS_REVIEW attempt row", () => {
  assert.equal(resolveAttemptRowDisplayStatus("NEEDS_REVIEW", "cancelled"), "cancelled");
});

it("terminal invoice overrides an undefined attempt row (treated as live)", () => {
  assert.equal(resolveAttemptRowDisplayStatus(undefined, "cancelled"), "cancelled");
});

it("non-terminal invoice leaves a PENDING attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("PENDING", "processing"), "PENDING");
});

it("non-terminal invoice leaves a SUCCESS attempt row unchanged", () => {
  assert.equal(resolveAttemptRowDisplayStatus("SUCCESS", "paid"), "SUCCESS");
});

});
