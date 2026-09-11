// src/shared/month-options.ts
//
// Shared "recent calendar months" quick-pick helper. Originally lived only on
// the ambassador detail page's recap range picker; extracted here so the
// programme-level recap screen (app/programs/[programId]/ambassadors/recap)
// can offer the exact same interaction instead of re-deriving it.

export type MonthOption = { key: string; label: string; from: string; to: string };

/** YYYY-MM-DD for a UTC calendar date, so month boundaries don't drift with the viewer's timezone. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Last `count` calendar months (oldest first, current month last) as recap quick-picks. */
export function getRecentMonthOptions(count: number): MonthOption[] {
  const now = new Date();
  const options: MonthOption[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i + 1, 0));
    options.push({
      key: toIsoDate(monthStart).slice(0, 7),
      label: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      from: toIsoDate(monthStart),
      to: toIsoDate(monthEnd),
    });
  }
  return options;
}
