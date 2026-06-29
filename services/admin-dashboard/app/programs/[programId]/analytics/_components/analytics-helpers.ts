// app/programs/[programId]/analytics/_components/analytics-helpers.ts

export const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#6366f1",
];

const NOISE_LABELS = ["Not Specified", "Unknown"];

/** Strip noise buckets from chart data. Use ONLY for chart feeds — cards and tables show everything. */
export function stripNoiseBuckets<T>(data: T[], keyField: keyof T): T[] {
  return data.filter((item) => !NOISE_LABELS.includes(String(item[keyField])));
}

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
