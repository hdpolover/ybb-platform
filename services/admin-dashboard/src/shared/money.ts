// Mirrors `services/api/src/shared/utils/money.ts`. Kept here because the admin
// dashboard runs in a separate package and cannot import the API's util directly.
// Keep both in sync — they are sister implementations of the same contract,
// to be unified in Phase 5 once Decimal columns become NOT NULL.

export function roundToNearest(value: number, step: number): number {
  if (step <= 0) {
    throw new Error("step must be positive");
  }
  return Math.round(value / step) * step;
}

export function convertUsdToIdr(
  usd: number,
  rateIdrPerUsd: number,
  roundingStep = 1000,
): number {
  if (rateIdrPerUsd <= 0) {
    throw new Error("rateIdrPerUsd must be positive");
  }
  return roundToNearest(usd * rateIdrPerUsd, roundingStep);
}
