import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as a compact currency string (e.g. 1500000 → "Rp 1.5M"). */
export function formatCurrency(
  amount: number,
  currency: "IDR" | "USD" = "IDR",
): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Format a date string to a human-readable locale string. */
export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const parsed = parseApiDate(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(parsed);
}

/** Format a date-time string safely; returns em dash when invalid/missing. */
export function formatDateTime(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const parsed = parseApiDate(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(parsed);
}

/** Parse backend date values consistently before local rendering. */
export function parseApiDate(date: unknown): Date {
  if (date === null || date === undefined) return new Date("");
  if (date instanceof Date) return date;

  if (typeof date === "number") {
    return new Date(date);
  }

  if (typeof date === "object") {
    const candidate = date as Record<string, unknown>;
    const nested = candidate.$date ?? candidate.date ?? candidate.value ?? candidate.iso;
    if (nested !== undefined && nested !== date) {
      return parseApiDate(nested);
    }
    return new Date("");
  }

  const raw = String(date).trim();
  if (!raw) return new Date("");

  // Date-only values should remain date-only in user locale.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00`);
  }

  // If timezone info is missing, interpret as UTC to avoid server/local drift.
  const normalized = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(raw) ? raw : `${raw}Z`;
  return new Date(normalized);
}

/** Convert local datetime-local input value to UTC ISO string for API writes. */
export function toUtcIsoFromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** Convert UTC/ISO backend value to datetime-local input value in user locale. */
export function toLocalDatetimeInputValue(value: string | Date | null | undefined): string {
  const parsed = parseApiDate(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** Truncate a string to a max length, appending "…" if needed. */
export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

/** Return initials from a full name (e.g. "John Doe" → "JD"). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
