"use client";

export type ProgramAnnouncementStatus = "draft" | "scheduled" | "published";

export function richTextToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function buildAnnouncementExcerpt(value: string, maxLength: number = 120): string {
  const text = richTextToPlainText(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function formatAnnouncementLabel(value?: string | null): string {
  return (value ?? "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function parseTagInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeOptionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseAnnouncementDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getProgramAnnouncementStatus(input: {
  isActive: boolean;
  publishDate?: string | Date | null;
}): ProgramAnnouncementStatus {
  if (!input.isActive) {
    return "draft";
  }

  const publishDate = parseAnnouncementDate(input.publishDate);
  if (publishDate && publishDate.getTime() > Date.now()) {
    return "scheduled";
  }

  return "published";
}

export function getProgramAnnouncementStatusLabel(status: ProgramAnnouncementStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    default:
      return "Published";
  }
}

export function getProgramAnnouncementStatusClasses(status: ProgramAnnouncementStatus): string {
  switch (status) {
    case "draft":
      return "bg-zinc-100 text-zinc-600";
    case "scheduled":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-emerald-50 text-emerald-700";
  }
}

export function toDateTimeLocalValue(value?: string | Date | null): string {
  const parsed = parseAnnouncementDate(value);
  if (!parsed) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    parsed.getFullYear(),
    pad(parsed.getMonth() + 1),
    pad(parsed.getDate()),
  ].join("-") + `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function dateTimeLocalToIsoString(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}
