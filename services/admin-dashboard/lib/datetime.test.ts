/**
 * Standalone test for the WIB timezone helpers.
 * The admin dashboard has no test framework; run directly with Node's native
 * TypeScript support:  node lib/datetime.test.ts
 */
import assert from "node:assert/strict";
import {
  BUSINESS_TIMEZONE,
  zonedInputToUtcIso,
  utcToZonedInput,
  formatInBusinessTz,
} from "./datetime.ts";

let passed = 0;
function t(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ✓", name);
}

// WIB (Asia/Jakarta) is a fixed UTC+7 with no DST.

t("end-of-day WIB input -> UTC", () => {
  assert.equal(zonedInputToUtcIso("2026-07-15T23:59"), "2026-07-15T16:59:00.000Z");
});

t("start-of-day WIB input -> UTC (crosses date)", () => {
  assert.equal(zonedInputToUtcIso("2026-04-15T00:00"), "2026-04-14T17:00:00.000Z");
});

t("UTC -> WIB input value", () => {
  assert.equal(utcToZonedInput("2026-07-15T16:59:00.000Z"), "2026-07-15T23:59");
});

t("UTC -> WIB input value (crosses date back)", () => {
  assert.equal(utcToZonedInput("2026-04-14T17:00:00.000Z"), "2026-04-15T00:00");
});

t("roundtrip stable for several wall times", () => {
  for (const v of [
    "2026-01-01T00:00",
    "2026-07-15T23:59",
    "2026-12-31T12:30",
    "2026-03-09T09:05",
  ]) {
    assert.equal(utcToZonedInput(zonedInputToUtcIso(v)), v, `roundtrip ${v}`);
  }
});

t("seconds preserved", () => {
  assert.equal(zonedInputToUtcIso("2026-07-15T23:59:30"), "2026-07-15T16:59:30.000Z");
});

t("regression: 23:59 WIB is NOT stored as 23:59 UTC (the CYS bug)", () => {
  assert.notEqual(zonedInputToUtcIso("2026-07-15T23:59"), "2026-07-15T23:59:00.000Z");
});

t("empty / invalid handling", () => {
  assert.equal(zonedInputToUtcIso(""), null);
  assert.equal(zonedInputToUtcIso(null), null);
  assert.equal(zonedInputToUtcIso(undefined), null);
  assert.equal(utcToZonedInput(null), "");
  assert.equal(utcToZonedInput(""), "");
  assert.equal(utcToZonedInput("not-a-date"), "");
});

t("display shows WIB wall clock regardless of stored UTC instant", () => {
  const s = formatInBusinessTz("2026-07-15T16:59:00.000Z", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  assert.match(s, /15 Jul 2026/);
  assert.match(s, /23:59/);
});

t("already-UTC ISO input passes through unchanged", () => {
  assert.equal(
    zonedInputToUtcIso("2026-07-15T16:59:00.000Z"),
    "2026-07-15T16:59:00.000Z",
  );
});

t("BUSINESS_TIMEZONE is Asia/Jakarta", () => {
  assert.equal(BUSINESS_TIMEZONE, "Asia/Jakarta");
});

console.log(`\n${passed} tests passed`);
