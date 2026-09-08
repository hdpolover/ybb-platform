// services/admin-dashboard/lib/readiness-summary.ts

export type ReadinessSummaryRow = {
  subjectType: "brand" | "program";
  subjectId: string;
  brandId: string;
  blockerCount: number;
  warningCount: number;
  evaluatedAt: string;
};

// A snapshot is only as fresh as the last cron run. Anything older than two
// days is shown as stale rather than presented as current truth.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export function staleness(evaluatedAt: string): "current" | "stale" {
  return Date.now() - new Date(evaluatedAt).getTime() > STALE_AFTER_MS ? "stale" : "current";
}

export function summarize(rows: ReadinessSummaryRow[]) {
  return {
    subjectsWithBlockers: rows.filter((r) => r.blockerCount > 0).length,
    subjectsClear: rows.filter((r) => r.blockerCount === 0).length,
    totalBlockers: rows.reduce((sum, r) => sum + r.blockerCount, 0),
    totalWarnings: rows.reduce((sum, r) => sum + r.warningCount, 0),
  };
}
