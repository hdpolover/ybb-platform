// file: services/api/src/modules/programs/application/validators/pricing-tier-validity-period.validator.spec.ts
import { BadRequestException } from '@nestjs/common';
import {
  assertValidPeriodRange,
  assertNoDuplicatePeriod,
  findOverlappingPeriods,
  computeCoverageGap,
  ExistingValidityPeriod,
} from './pricing-tier-validity-period.validator';

describe('pricing-tier-validity-period.validator', () => {
  describe('assertValidPeriodRange', () => {
    it('rejects a zero-length period (start == end)', () => {
      // Real prod row: MEYS "Period 8", 2026-09-03 16:59 -> 2026-09-03 16:59.
      // A zero-length window never contains `now()`, so the tier it belongs
      // to silently never resolves — this is exactly the class of bug that
      // caused the CTA outage.
      const start = new Date('2026-09-03T16:59:00.000Z');
      const end = new Date('2026-09-03T16:59:00.000Z');

      expect(() => assertValidPeriodRange(start, end)).toThrow(BadRequestException);
      expect(() => assertValidPeriodRange(start, end)).toThrow(/end_date/);
    });

    it('rejects an inverted range (end before start)', () => {
      const start = new Date('2026-09-05T00:00:00.000Z');
      const end = new Date('2026-09-01T00:00:00.000Z');

      expect(() => assertValidPeriodRange(start, end)).toThrow(BadRequestException);
    });

    it('accepts a normal forward-moving range', () => {
      const start = new Date('2026-09-01T00:00:00.000Z');
      const end = new Date('2026-09-02T00:00:00.000Z');

      expect(() => assertValidPeriodRange(start, end)).not.toThrow();
    });
  });

  describe('assertNoDuplicatePeriod', () => {
    // Real prod incident: China self-funded "Period 12" has 5 byte-identical
    // rows (same tier, same start_date, same end_date, description "Period 12").
    const existing: ExistingValidityPeriod[] = [
      {
        id: 'period-12',
        startDate: new Date('2026-09-20T16:59:00.000Z'),
        endDate: new Date('2026-10-21T16:59:00.000Z'),
        description: 'Period 12',
      },
    ];

    it('rejects a new period with identical start_date and end_date to an existing one', () => {
      const candidate = {
        startDate: new Date('2026-09-20T16:59:00.000Z'),
        endDate: new Date('2026-10-21T16:59:00.000Z'),
      };

      expect(() => assertNoDuplicatePeriod(candidate, existing)).toThrow(BadRequestException);
    });

    it('excludes the row being updated from its own duplicate check', () => {
      // Updating period-12 in place (e.g. only its description) must not
      // trip over comparing it against itself.
      const candidate = {
        startDate: new Date('2026-09-20T16:59:00.000Z'),
        endDate: new Date('2026-10-21T16:59:00.000Z'),
      };

      expect(() => assertNoDuplicatePeriod(candidate, existing, 'period-12')).not.toThrow();
    });

    it('allows a period with the same start but a different end', () => {
      const candidate = {
        startDate: new Date('2026-09-20T16:59:00.000Z'),
        endDate: new Date('2026-10-22T16:59:00.000Z'),
      };

      expect(() => assertNoDuplicatePeriod(candidate, existing)).not.toThrow();
    });
  });

  describe('findOverlappingPeriods', () => {
    // Real prod pattern: admins enter periods back-to-back, A.end == B.start.
    // That's the deliberate, normal shape of the data and must never be
    // flagged as an overlap.
    it('does not flag boundary-touching periods as overlapping (half-open [start,end))', () => {
      const existing: ExistingValidityPeriod[] = [
        {
          id: 'period-a',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-09-02T00:00:00.000Z'),
        },
      ];
      const candidate = {
        startDate: new Date('2026-09-02T00:00:00.000Z'),
        endDate: new Date('2026-09-03T00:00:00.000Z'),
      };

      expect(findOverlappingPeriods(candidate, existing)).toEqual([]);
    });

    it('flags a genuinely overlapping period as a warning, not an error', () => {
      // Real prod: MEYS fully-funded P4 (Jul 28 -> Aug 31) and P5
      // (Jul 28 -> Sep 1) both cover "now" simultaneously. This must be
      // reported, but assertNoDuplicatePeriod/assertValidPeriodRange must
      // not throw for it — overlap alone is not a hard error.
      const existing: ExistingValidityPeriod[] = [
        {
          id: 'p4',
          startDate: new Date('2026-07-28T00:00:00.000Z'),
          endDate: new Date('2026-08-31T00:00:00.000Z'),
        },
      ];
      const candidate = {
        startDate: new Date('2026-07-28T00:00:00.000Z'),
        endDate: new Date('2026-09-01T00:00:00.000Z'),
      };

      const result = findOverlappingPeriods(candidate, existing);
      expect(result.map((p) => p.id)).toEqual(['p4']);
    });

    it('excludes the row being updated from its own overlap check', () => {
      const existing: ExistingValidityPeriod[] = [
        {
          id: 'p4',
          startDate: new Date('2026-07-28T00:00:00.000Z'),
          endDate: new Date('2026-08-31T00:00:00.000Z'),
        },
      ];
      const candidate = {
        startDate: new Date('2026-07-28T00:00:00.000Z'),
        endDate: new Date('2026-08-31T00:00:00.000Z'),
      };

      expect(findOverlappingPeriods(candidate, existing, 'p4')).toEqual([]);
    });

    it('does not flag two periods that do not touch at all', () => {
      const existing: ExistingValidityPeriod[] = [
        {
          id: 'period-a',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-09-02T00:00:00.000Z'),
        },
      ];
      const candidate = {
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-02T00:00:00.000Z'),
      };

      expect(findOverlappingPeriods(candidate, existing)).toEqual([]);
    });
  });

  describe('computeCoverageGap', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');

    it('returns null when registration_close_date is null (nothing to compare against)', () => {
      const periods = [
        { startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: new Date('2026-08-25T00:00:00.000Z') },
      ];

      expect(computeCoverageGap(periods, now, null)).toBeNull();
    });

    it('returns null when periods fully cover now through registration_close_date', () => {
      const closeDate = new Date('2026-09-01T00:00:00.000Z');
      const periods = [
        { startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: new Date('2026-09-05T00:00:00.000Z') },
      ];

      expect(computeCoverageGap(periods, now, closeDate)).toBeNull();
    });

    it('merges contiguous (A.end == B.start) periods and reports no gap', () => {
      const closeDate = new Date('2026-09-01T00:00:00.000Z');
      const periods = [
        { startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: new Date('2026-08-15T00:00:00.000Z') },
        { startDate: new Date('2026-08-15T00:00:00.000Z'), endDate: new Date('2026-09-05T00:00:00.000Z') },
      ];

      expect(computeCoverageGap(periods, now, closeDate)).toBeNull();
    });

    it('reports the gap when coverage ends before registration_close_date', () => {
      // This is the exact production failure mode: admins stopped
      // hand-entering daily one-day periods, coverage ended, and the CTA
      // vanished while registration was still meant to be open.
      const closeDate = new Date('2026-09-10T00:00:00.000Z');
      const periods = [
        { startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: new Date('2026-08-25T00:00:00.000Z') },
      ];

      const gap = computeCoverageGap(periods, now, closeDate);
      expect(gap).not.toBeNull();
      expect(gap?.gapStart).toEqual(new Date('2026-08-25T00:00:00.000Z'));
      expect(gap?.gapEnd).toEqual(closeDate);
      expect(gap?.daysUncovered).toBe(16);
    });

    it('reports a gap starting at now when no period covers now at all', () => {
      const closeDate = new Date('2026-09-10T00:00:00.000Z');
      const periods = [
        { startDate: new Date('2026-09-05T00:00:00.000Z'), endDate: new Date('2026-09-08T00:00:00.000Z') },
      ];

      const gap = computeCoverageGap(periods, now, closeDate);
      expect(gap?.gapStart).toEqual(now);
      expect(gap?.gapEnd).toEqual(new Date('2026-09-05T00:00:00.000Z'));
    });

    it('returns null when registration_close_date has already passed', () => {
      const closeDate = new Date('2026-08-01T00:00:00.000Z'); // before `now`
      const periods: { startDate: Date; endDate: Date }[] = [];

      expect(computeCoverageGap(periods, now, closeDate)).toBeNull();
    });
  });
});
