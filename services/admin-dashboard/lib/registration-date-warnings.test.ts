// services/admin-dashboard/lib/registration-date-warnings.test.ts
/**
 * Vitest suite for the registration-date advisory-warnings helper.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { computeRegistrationDateWarnings, type WarningTier } from "./registration-date-warnings.ts";

const NOW = new Date("2026-09-07T04:00:00.000Z"); // 11:00 WIB

function regFeeTier(category: string, periods: { start: string; end: string }[]): WarningTier {
  return {
    feeType: "registration_fee",
    allowedCategories: [category],
    validityPeriods: periods.map((p) => ({ startDate: p.start, endDate: p.end })),
  };
}

// A fully-configured program: both categories, each with a registration-fee
// tier whose window covers "now", and the tier window matches the program
// close date exactly. Should be silent.
const CLEAN_TIERS: WarningTier[] = [
  regFeeTier("self_funded", [{ start: "2026-01-01T00:00:00.000Z", end: "2026-12-01T16:59:00.000Z" }]),
  regFeeTier("fully_funded", [{ start: "2026-01-01T00:00:00.000Z", end: "2026-12-01T16:59:00.000Z" }]),
];

describe("registration-date-warnings", () => {

it("a correctly configured program produces no warnings", () => {
  const warnings = computeRegistrationDateWarnings({
    registrationOpenDate: "2026-01-01T00:00:00.000Z",
    registrationCloseDate: "2026-12-01T16:59:00.000Z",
    tiers: CLEAN_TIERS,
    now: NOW,
  });
  assert.deepEqual(warnings, []);
});

it("check 1: tier window ends after program close (the KYS 4th case)", () => {
  const warnings = computeRegistrationDateWarnings({
    registrationCloseDate: "2027-03-05T16:59:00.000Z",
    tiers: [regFeeTier("self_funded", [{ start: "2026-01-01T00:00:00.000Z", end: "2027-03-20T16:59:00.000Z" }])],
    now: NOW,
  });
  const hit = warnings.find((w) => w.id === "close-vs-tier-window");
  assert.ok(hit, "expected close-vs-tier-window warning");
  assert.match(hit!.message, /5 Mar 2027/);
  assert.match(hit!.message, /20 Mar 2027/);
});

it("check 1: tier window ends before program close", () => {
  const warnings = computeRegistrationDateWarnings({
    registrationCloseDate: "2026-12-31T16:59:00.000Z",
    tiers: [regFeeTier("self_funded", [{ start: "2026-01-01T00:00:00.000Z", end: "2026-11-02T16:59:00.000Z" }])],
    now: NOW,
  });
  const hit = warnings.find((w) => w.id === "close-vs-tier-window");
  assert.ok(hit, "expected close-vs-tier-window warning");
  assert.match(hit!.message, /later than/);
});

it("check 2: category has a registration-fee tier, but no window covers today", () => {
  const warnings = computeRegistrationDateWarnings({
    registrationCloseDate: "2026-12-31T16:59:00.000Z",
    tiers: [
      regFeeTier("fully_funded", [{ start: "2026-01-01T00:00:00.000Z", end: "2026-08-21T16:59:00.000Z" }]),
      regFeeTier("self_funded", [{ start: "2026-01-01T00:00:00.000Z", end: "2026-11-02T16:59:00.000Z" }]),
    ],
    now: NOW,
  });
  const hit = warnings.find((w) => w.id === "no-active-window-fully_funded");
  assert.ok(hit, "expected no-active-window-fully_funded warning");
  assert.match(hit!.message, /Fully Funded/);
});

it("check 3: program offers a category (via a program-fee tier) with no registration-fee tier at all", () => {
  const warnings = computeRegistrationDateWarnings({
    tiers: [
      { feeType: "program_fee_1", allowedCategories: ["fully_funded"], validityPeriods: [] },
      regFeeTier("self_funded", [{ start: "2026-01-01T00:00:00.000Z", end: "2026-12-31T16:59:00.000Z" }]),
    ],
    now: NOW,
  });
  const hit = warnings.find((w) => w.id === "no-reg-fee-tier-fully_funded");
  assert.ok(hit, "expected no-reg-fee-tier-fully_funded warning");
  // Should NOT also fire the "no active window" check for the same category.
  assert.equal(warnings.filter((w) => w.id.includes("fully_funded")).length, 1);
});

it("check 4: bare-midnight-UTC close date is flagged with its WIB reading", () => {
  const warnings = computeRegistrationDateWarnings({
    registrationCloseDate: "2026-07-16T00:00:00.000Z",
    tiers: [regFeeTier("self_funded", [{ start: "2026-01-01T00:00:00.000Z", end: "2026-07-16T00:00:00.000Z" }])],
    now: NOW,
  });
  const hit = warnings.find((w) => w.id.startsWith("bare-calendar-day-The program's registration close date"));
  assert.ok(hit, "expected a bare-calendar-day warning for the program close date");
  assert.match(hit!.message, /07:00/);
});

it("check 4: a proper end-of-day WIB instant (16:59 UTC) is not flagged", () => {
  const warnings = computeRegistrationDateWarnings({
    registrationCloseDate: "2026-07-15T16:59:00.000Z",
    tiers: [regFeeTier("self_funded", [{ start: "2026-01-01T00:00:00.000Z", end: "2026-07-15T16:59:00.000Z" }])],
    now: NOW,
  });
  assert.equal(warnings.filter((w) => w.id.startsWith("bare-calendar-day")).length, 0);
});

it("no tiers at all: no category warnings fire (nothing to compare against)", () => {
  const warnings = computeRegistrationDateWarnings({
    registrationCloseDate: "2026-07-15T16:59:00.000Z",
    tiers: [],
    now: NOW,
  });
  assert.deepEqual(warnings, []);
});

it("missing/invalid dates never throw", () => {
  assert.doesNotThrow(() => {
    computeRegistrationDateWarnings({
      registrationCloseDate: null,
      tiers: [regFeeTier("self_funded", [{ start: "not-a-date", end: "" }])],
      now: NOW,
    });
  });
});

});
