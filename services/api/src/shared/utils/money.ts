/**
 * Rounds a value to the nearest step (round half up at exact midpoints).
 *
 * @example roundToNearest(263775, 1000) === 264000
 */
export function roundToNearest(value: number, step: number): number {
  if (step <= 0) {
    throw new Error('step must be positive');
  }
  return Math.round(value / step) * step;
}

/**
 * Converts a USD amount to IDR using the supplied rate, then rounds.
 * Default rounding step is 1000 IDR (admin-friendly clean amounts).
 */
export function convertUsdToIdr(
  usd: number,
  rateIdrPerUsd: number,
  roundingStep = 1000,
): number {
  if (rateIdrPerUsd <= 0) {
    throw new Error('rateIdrPerUsd must be positive');
  }
  return roundToNearest(usd * rateIdrPerUsd, roundingStep);
}

/**
 * Converts an IDR amount to USD using the supplied rate, rounded to 2 decimals.
 */
export function convertIdrToUsd(idr: number, rateIdrPerUsd: number): number {
  if (rateIdrPerUsd <= 0) {
    throw new Error('rateIdrPerUsd must be positive');
  }
  return Math.round((idr / rateIdrPerUsd) * 100) / 100;
}
