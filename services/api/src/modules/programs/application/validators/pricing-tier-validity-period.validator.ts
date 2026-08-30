// file: services/api/src/modules/programs/application/validators/pricing-tier-validity-period.validator.ts
import { BadRequestException } from '@nestjs/common';

/**
 * Incident, 2026-08-21: `pricing_tier_validity_periods` rows carry NO price —
 * price lives on `program_pricing_tiers`. A period is purely a time window
 * that gates whether a tier resolves as "active" right now. Admins were
 * hand-entering ONE-DAY periods daily; when they missed a day, the Fully
 * Funded / Self Funded CTA silently disappeared and paying participants
 * could not check out. This module hardens the two write paths that can
 * corrupt that time window: bad ranges and byte-identical duplicates.
 * Overlap between periods is deliberately NOT blocked here — see
 * `findOverlappingPeriods` below for why.
 */

export type ValidityPeriodRange = {
  startDate: Date;
  endDate: Date;
};

export type ExistingValidityPeriod = ValidityPeriodRange & {
  id: string;
  description?: string | null;
};

export type CoverageGap = {
  gapStart: Date;
  gapEnd: Date;
  daysUncovered: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Prod had exactly one row where start_date == end_date (MEYS "Period 8",
 * 2026-09-03 16:59 -> 2026-09-03 16:59). A zero-length (or inverted) window
 * can never contain `now()`, so it is dead weight that silently never
 * activates — reject it outright rather than let it accumulate.
 */
export function assertValidPeriodRange(startDate: Date, endDate: Date): void {
  if (endDate.getTime() <= startDate.getTime()) {
    throw new BadRequestException(
      `Validity period end_date (${endDate.toISOString()}) must be strictly after start_date (${startDate.toISOString()}).`,
    );
  }
}

/**
 * Prod had one tier (China self-funded "Period 12") with 5 byte-identical
 * rows — same start_date, same end_date, same description. Nothing produces
 * that from a single legitimate save; it's a symptom of retried/duplicated
 * writes. Reject an exact duplicate (same tier scope is enforced by the
 * caller passing only that tier's periods) while excluding the row being
 * updated from the check against itself.
 */
export function assertNoDuplicatePeriod(
  candidate: ValidityPeriodRange,
  existingPeriods: ExistingValidityPeriod[],
  excludeId?: string,
): void {
  const duplicate = existingPeriods.find(
    (period) =>
      period.id !== excludeId &&
      period.startDate.getTime() === candidate.startDate.getTime() &&
      period.endDate.getTime() === candidate.endDate.getTime(),
  );
  if (duplicate) {
    throw new BadRequestException(
      `An identical validity period already exists (${candidate.startDate.toISOString()} -> ${candidate.endDate.toISOString()}).`,
    );
  }
}

/**
 * Overlap is a WARNING, not a hard error. A prod audit (2026-08-21) found 84
 * overlapping pairs already live across China Youth Summit and Middle East
 * Youth Summit — e.g. MEYS fully-funded P4 (Jul 28 -> Aug 31) and P5 (Jul 28
 * -> Sep 1) both cover "now" simultaneously. Periods carry no price, so
 * overlap has no pricing consequence; it's an admin-hygiene signal, not a
 * correctness bug. Blocking it would make every touch of e.g. China
 * self-funded's month-spanning "Period 12" reject on save, since it swallows
 * Periods 2-12 entirely — trading a silent data smell for a loud admin
 * outage. Report overlaps so the UI can surface them without refusing the
 * write.
 *
 * Uses half-open [start, end) semantics: prod data is deliberately
 * contiguous (period A.end_date == period B.start_date), so a shared
 * boundary is NOT counted as overlap. NOTE: this differs from how the read
 * path actually resolves the active period — `resolveTierPeriod` in both
 * `get-portal-payments.handler.ts` and `calculate-portal-total-required.ts`
 * uses a closed interval on both ends (`start <= ref && end >= ref`), so at
 * the exact boundary instant both the outgoing and incoming period match.
 * That's harmless in practice (`.find()` just picks whichever appears first
 * in the array, and boundaries are minute-precision so the exposure window
 * is a single instant) but it means the read path's notion of "touching" is
 * looser than the half-open model here. Flagging boundary-touching periods
 * as a warning would just relabel the existing, harmless contiguous-data
 * convention as a problem, so we don't.
 * NOTE: `resolveTierPeriod` referenced above now lives in
 * `shared/utils/tier-period.util.ts` (previously duplicated across
 * `get-portal-payments.handler.ts` and `calculate-portal-total-required.ts`).
 */
export function findOverlappingPeriods(
  candidate: ValidityPeriodRange,
  existingPeriods: ExistingValidityPeriod[],
  excludeId?: string,
): ExistingValidityPeriod[] {
  return existingPeriods.filter((period) => {
    if (period.id === excludeId) return false;
    return (
      candidate.startDate.getTime() < period.endDate.getTime() &&
      period.startDate.getTime() < candidate.endDate.getTime()
    );
  });
}

/**
 * Coverage gap is informational only (see `findOverlappingPeriods` for why
 * blocking is the wrong lever). Computes the FIRST uncovered interval between
 * `now` and the program's `registration_close_date` so the admin UI can show
 * "registration will stop resolving pricing on <date> unless you add a
 * period" instead of admins discovering the outage the hard way. Contiguous
 * periods (A.end == B.start) merge into one covered span — that's the normal,
 * deliberate way admins have been entering data.
 *
 * Returns null when there's nothing to compare against (no
 * registration_close_date) or when the close date has already passed.
 */
export function computeCoverageGap(
  periods: ValidityPeriodRange[],
  now: Date,
  registrationCloseDate: Date | null,
): CoverageGap | null {
  if (!registrationCloseDate) return null;
  if (registrationCloseDate.getTime() <= now.getTime()) return null;

  const sorted = [...periods].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  let cursor = now.getTime();
  const closeTime = registrationCloseDate.getTime();

  for (const period of sorted) {
    const start = period.startDate.getTime();
    const end = period.endDate.getTime();
    if (end <= cursor) continue; // entirely in the past relative to cursor
    if (start > closeTime) break; // this and all later periods (sorted) start after the window we care about
    if (start > cursor) {
      const gapEnd = Math.min(start, closeTime);
      return buildGap(cursor, gapEnd);
    }
    cursor = Math.max(cursor, end);
    if (cursor >= closeTime) return null;
  }

  if (cursor < closeTime) {
    return buildGap(cursor, closeTime);
  }
  return null;
}

function buildGap(startMs: number, endMs: number): CoverageGap {
  return {
    gapStart: new Date(startMs),
    gapEnd: new Date(endMs),
    daysUncovered: Math.ceil((endMs - startMs) / MS_PER_DAY),
  };
}
